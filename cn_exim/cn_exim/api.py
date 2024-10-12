import frappe

@frappe.whitelist()
def get_api_list(pr):
    if pr:
        pr_doc=frappe.get_doc("Pickup Request",pr)
        return pr_doc.name_of_supplier,pr_doc.purchase_order_details
    




    
    
    