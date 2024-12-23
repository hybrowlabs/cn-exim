import frappe
from india_compliance.gst_india.constants.e_waybill import selling_address
from india_compliance.gst_india.constants.e_waybill import buying_address
from india_compliance.gst_india.constants.e_waybill import stock_entry_address

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
