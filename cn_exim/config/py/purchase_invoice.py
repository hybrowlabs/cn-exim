import frappe
from frappe.utils import now_datetime, add_days, formatdate

@frappe.whitelist()
def get_payment_trams(name):
    data = frappe.db.sql(" select payment_terms_template from `tabPurchase Order` where name=%s ", (name), as_dict=True)
    
    return data


@frappe.whitelist()
def get_due_date_based_on_condition(pr):
    purchase_receipt = frappe.get_doc("Purchase Receipt", pr)
    purchase_order = frappe.get_doc("Purchase Order", purchase_receipt.items[0].purchase_order)
    
    payment_term = None
    if purchase_order.payment_schedule:
        payment_term = purchase_order.payment_schedule[0].payment_term
    
    if payment_term:
        due_date_based_on = frappe.get_value("Payment Term", payment_term, "due_date_based_on")
        days_to_add = frappe.get_value("Payment Term", payment_term, "credit_days")
        
        if due_date_based_on == "After invoice creation":
            today_datetime = now_datetime()
            new_date = add_days(today_datetime, days_to_add)
            return {"due_date":frappe.utils.formatdate(new_date.date(), "yyyy-mm-dd")}
        elif due_date_based_on == "After PR is created":
            today_datetime = purchase_receipt.posting_date
        else:
            # Handle the case when due_date_based_on is not in either dictionary
            if due_date_based_on in ["Completion of Work","On Installation"]:
                return {"status":True}
            return None
        
        new_date = add_days(today_datetime, days_to_add)
        return {"due_date":new_date}

    # Handle the case when payment_term is not found
    return None