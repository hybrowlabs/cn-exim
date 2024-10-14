import frappe
from frappe.utils import getdate, today

@frappe.whitelist()
def get_api_list(pr):
    if pr:
        pr_doc=frappe.get_doc("Pickup Request",pr)
        return pr_doc.name_of_supplier,pr_doc.purchase_order_details
    




def validate_date(self ,method):
    if self.quotation_number:
        doc=frappe.get_doc("Request for Quotation",self.quotation_number)
        if getdate(doc.schedule_date)<getdate(today()):
            frappe.throw("You Cannot Submit?Edit Quotation After End Date")




@frappe.whitelist()
def supplier_quotation(supplier,rfq):
    pass

