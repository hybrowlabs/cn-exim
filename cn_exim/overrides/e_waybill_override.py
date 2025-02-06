import frappe
from india_compliance.gst_india.constants.e_waybill import selling_address
from india_compliance.gst_india.constants.e_waybill import buying_address
from india_compliance.gst_india.constants.e_waybill import stock_entry_address
from india_compliance.gst_india.utils import is_outward_stock_entry
    

e_waybill_address = {
    "bill_from": "bill_from",
    "bill_to": "bill_to",
    "ship_from": "ship_from",
    "ship_to": "ship_to",
}

    
ADDRESS_FIELDS = { 
    "Sales Invoice": selling_address,
    "Purchase Invoice": buying_address,
    "Delivery Note": selling_address,
    "Purchase Receipt": buying_address,
    "Stock Entry": stock_entry_address,
    "Subcontracting Receipt": buying_address,
    "E-way Bill": e_waybill_address,
}

PERMITTED_DOCTYPES = list(ADDRESS_FIELDS.keys())
def custom_validate_doctype_for_e_waybill(self):
        if self.doc.doctype not in PERMITTED_DOCTYPES:
            frappe.throw(
                frappe._("{0} is not supported for e-Waybill actions").format(
                    self.doc.doctype
                ),
                title=frappe._("Unsupported DocType"),
            )



def custom_validate_applicability(self):
        """
        Validates:
        - Required fields
        - Atleast one item with HSN for goods is required
        - Basic transporter details must be present
        - Transaction does not have any non-GST items
        - Sales Invoice with same company and billing gstin
        - Inward Stock Transfer with same company and supplier gstin
        - Outward Material Transfer with different company and supplier gstin
        """
        address = ADDRESS_FIELDS.get(self.doc.doctype)
        for key in ("bill_from", "bill_to"):
            if not self.doc.get(address[key]):
                frappe.throw(
                    ("{0} is required to generate e-Waybill").format((address[key])),
                    exc=frappe.MandatoryError,
                )

        # Atleast one item with HSN code of goods is required
        for item in self.doc.items:
            if not item.gst_hsn_code.startswith("99"):
                break

        else:
            frappe.throw(
                (
                    "e-Waybill cannot be generated because all items have service HSN"
                    " codes"
                ),
                title=("Invalid Data"),
            )
            
        if not self.doc.gst_transporter_id:
            self.validate_mode_of_transport()

        self.validate_non_gst_items()

        if is_outward_stock_entry(self.doc):
            self.validate_different_gstin()
        else:
            self.validate_same_gstin()