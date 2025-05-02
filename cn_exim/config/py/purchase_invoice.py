import frappe
from frappe.utils import now_datetime, add_days, formatdate

@frappe.whitelist()
def get_payment_trams(name):
    data = frappe.db.sql(" select payment_terms_template from `tabPurchase Order` where name=%s ", (name), as_dict=True)
    
    return data


@frappe.whitelist()
def get_due_date_based_on_condition(pr):
    purchase_receipt = frappe.get_doc("Purchase Receipt", pr)
    if purchase_receipt.items[0].purchase_order:
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

@frappe.whitelist()
def get_landed_cost_voucher_details(purchase_invoice_name, custom_purchase_order):
    # print("@@@@@@@@@@-->",custom_purchase_order)
    # if custom_purchase_order:
    #     pass

    # purchase_order_item=frappe.db.sql("select name from `tabPurchase Order Item` where parent=%s",[custom_purchase_order],as_dict=True)

    # purchase_order_item_name=purchase_order_item[0]["name"]

    # items = frappe.get_all("Purchase Receipt Item",filters={"purchase_order_item":purchase_order_item_name},fields=["parent"])
    # print("@@@@@@@@@@@@@@@@@@@@@@@@->",items)
    # pi_doc = frappe.get_doc("Purchase Invoice", purchase_invoice_name)
    # pr_docs = []
    # for items in pi_doc.items:
    #     pr = items.parent
    #     pr_docs.append(pr)
        

    # pr_uni = set(pr_docs)
    # print("@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@",pr_uni)
    # return pr_uni

    try:
        purchase_receipts = []
        taxes_data = []
        purchase_invoice_details=[]
        
        # Check if we have a valid purchase order
        if not custom_purchase_order:
            frappe.throw(("Purchase Order reference is missing"))
        
        if purchase_invoice_name:
            pi_doc=frappe.get_doc("Purchase Invoice",purchase_invoice_name)
            purchase_invoice_details.append({
                "purchase_invoice":pi_doc.name,
                "supplier":pi_doc.supplier,
                "amount":pi_doc.total,
                "date":pi_doc.posting_date,
            })
            for item in pi_doc.items:
                taxes_data.append({
                    "account_head":item.expense_account,
                    "amount":item.amount,
                    "description":item.description,
                })
            for tax in pi_doc.taxes:
                taxes_data.append({
                    "charge_type": tax.charge_type,
                    "account_head": tax.account_head,
                    "description": tax.description,
                    "rate": tax.rate,
                    "amount": tax.tax_amount,
                    "total": tax.total,
                    "receipt_document": pi_doc.name
                })
        # Step 1: Get Gate Entry Details for this Purchase Order
        gate_entries = frappe.db.sql("""
            SELECT parent as gate_entry
            FROM `tabGate Entry Details`
            WHERE purchase_order = %s
        """, custom_purchase_order, as_dict=True)
        
        if not gate_entries:
            frappe.msgprint(("No Gate Entries found for Purchase Order {0}").format(custom_purchase_order))
            return [[]]
    
    
        # Step 2: For each Gate Entry, get the linked Purchase Receipts
        for ge in gate_entries:
            gate_entry_no=ge.gate_entry

            pr_list=frappe.db.sql("""
                SELECT name, supplier, grand_total
                FROM `tabPurchase Receipt`
                WHERE custom_gate_entry_no = %s
            """, gate_entry_no, as_dict=True)


            for pr in pr_list:
                purchase_receipts.append({
                    "name": pr.name,
                    "supplier": pr.supplier,
                    "grand_total": pr.grand_total
                })

                # pr_taxes = frappe.db.sql("""
                #         SELECT charge_type, account_head, description, rate, tax_amount, total
                #         FROM `tabPurchase Taxes and Charges`
                #         WHERE parent = %s
                #     """, pr.name, as_dict=True)
                
                # for tax in pr_taxes:
                #     taxes_data.append({
                #         "charge_type": tax.charge_type,
                #         "account_head": tax.account_head,
                #         "description": tax.description,
                #         "rate": tax.rate,
                #         "amount": tax.tax_amount,
                #         "total": tax.total,
                #         "receipt_document": pr.name
                #     })
        return [purchase_receipts, taxes_data, purchase_invoice_details]
    except Exception as e:
        frappe.log_error(f"Failed to get Landed Cost Voucher details: {str(e)}", 
                        "get_landed_cost_voucher_details error")
        frappe.throw(str(e))



@frappe.whitelist()
def get_invoice_data_for_import(boe_list):
    boe_list = frappe.json.loads(boe_list)

    # Store mapping between per_alert_check and boe_entry_no
    alert_to_boe_map = {}
    for boe_entry_no in boe_list:
        boe_doc = frappe.get_doc("BOE Entry", boe_entry_no)
        per_alert_check = boe_doc.get("per_alert_check")
        vendor = boe_doc.get("vendor")
        currency = boe_doc.get("currency")
        if per_alert_check:
            alert_to_boe_map[per_alert_check] = boe_entry_no

    child_details_list = []
    po_data_map = {}

    fields_to_sum = [
        "bcd_amount", "hcs_amount", "swl_amount", "total_duty",
        "freight_amount", "misc_charge_amt", "insurance_amount"
    ]

    # Add boe_entry_no to each item row
    for per_alert, boe_entry_no in alert_to_boe_map.items():
        data = frappe.db.sql(
            "SELECT * FROM `tabPre-Alert Item Details` WHERE parent = %s",
            (per_alert,),
            as_dict=True
        )
        for item in data:
            item["boe_entry_no"] = boe_entry_no
            child_details_list.append(item)

    # Aggregate values by po_no
    for item in child_details_list:
        po_no = item.get("po_no")
        boe_entry_no = item.get("boe_entry_no")
        if not po_no:
            continue

        key = (po_no, boe_entry_no)  # Combine po_no and boe_entry_no to uniquely group

        if key not in po_data_map:
            po_data_map[key] = {field: item.get(field, 0) or 0 for field in fields_to_sum}
            po_data_map[key]["po_no"] = po_no
            po_data_map[key]["boe_entry_no"] = boe_entry_no
        else:
            for field in fields_to_sum:
                po_data_map[key][field] += item.get(field, 0) or 0

    # Final conversion
    field_to_description = {
        "bcd_amount": "Basic Customs Duty",
        "hcs_amount": "Hazard Communication Standard",
        "swl_amount": "social welfare surcharge",
        "total_duty": "Duty",
        "freight_amount": "Freight",
        "misc_charge_amt": "Misc. Charge Amount",
        "insurance_amount": "Insurance Amount"
    }

    final_list = []

    for (po_no, boe_entry_no), values in po_data_map.items():
        for field, description in field_to_description.items():
            amount = values.get(field, 0) or 0
            if amount > 0:
                final_list.append({
                    "custom_po_number": po_no,
                    "custom_boe_entry": boe_entry_no,
                    "item_code": description,
                    "rate": amount,
                    "amount":amount,
                    "description": field,
                    "qty":1
                })

    # Example printout
    return final_list, vendor, currency


@frappe.whitelist()
def update_boe_entry(boe_list):
    boe_list = frappe.json.loads(boe_list)
    for boe_entry_no in boe_list:
        boe_doc = frappe.get_doc("BOE Entry", boe_entry_no)
        if boe_doc:
            boe_doc.update({
                "status": "To Bill",
            })
            boe_doc.save()
            frappe.db.commit()
