import frappe

@frappe.whitelist()
def get_purchase_invoice_item(name):
    
    purchase_invoice = frappe.db.sql(" select * from `tabPurchase Invoice Item` where parent=%s ",(name), as_dict=True)
    return purchase_invoice