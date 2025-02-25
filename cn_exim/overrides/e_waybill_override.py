import frappe
from india_compliance.gst_india.constants.e_waybill import (
    selling_address,
    buying_address,
    stock_entry_address
)
from india_compliance.gst_india.utils.e_waybill import get_billing_shipping_address_map
from india_compliance.gst_india.utils import is_outward_stock_entry
from india_compliance.gst_india.utils.e_waybill import EWaybillData
from frappe.utils import strip_html


e_waybill_address = {
    "bill_from": "bill_from_address",
    "bill_to": "bill_to_address",
    "ship_from": "ship_from_address",
    "ship_to": "ship_to_address",
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
    """
    Ensure the doctype exists in the permitted list before proceeding.
    """
    if self.doc.doctype not in PERMITTED_DOCTYPES:
        frappe.throw(
            frappe._("'{0}' is not supported for e-Waybill actions. Available doctypes: {1}").format(
                self.doc.doctype, ", ".join(PERMITTED_DOCTYPES)
            ),
            title=frappe._("Unsupported Doctype"),
        )

from frappe.utils import strip_html


def custom_validate_applicability(self):
    address = get_billing_shipping_address_map(self.doc) or {
        "bill_from": frappe.db.get_value("E-way Bill", "E-Way-Bill-001", "bill_from_address"),
        "bill_to": frappe.db.get_value("E-way Bill", "E-Way-Bill-001", "bill_to_address"),
        "ship_from": frappe.db.get_value("E-way Bill", "E-Way-Bill-001", "ship_from_address"),
        # "ship_to": frappe.db.get_value("E-way Bill", "E-Way-Bill-001", "ship_to_address")
    }
    frappe.throw(f"Fetching address: {address}")

    for key in ("bill_from", "bill_to", "ship_from"):
        if key not in address or not address[key]:
            frappe.throw(
                frappe._("Address field '{0}' is missing or empty in ADDRESS_FIELDS for {1}").format(
                    key, self.doc.doctype
                ),
                title=frappe._("Configuration Error"),
            )

        if not self.doc.get(address[key]):
            frappe.throw(
                frappe._("{0} is required to generate e-Waybill but is missing. Please check the document.").format(
                    _(address[key])
                ),
                exc=frappe.MandatoryError,
            )


    if not any(item.gst_hsn_code and not item.gst_hsn_code.startswith("99") for item in self.doc.items):
        frappe.throw(
            frappe._("e-Waybill cannot be generated because all items have service HSN codes"),
            title=frappe._("Invalid Data"),
        )

    if not self.doc.gst_transporter_id:
        self.validate_mode_of_transport()

    if is_outward_stock_entry(self.doc):
        self.validate_different_gstin()
    else:
        self.validate_same_gstin()
