import frappe
from frappe import _

def before_insert(doc,method):
    check_buying_settings(doc)

def on_submit(self, method):
    if self.items:
        for item in self.items:
            if item.purchase_order and item.custom_row_id:
                get_po = frappe.get_doc("Purchase Order", item.purchase_order)
                for schedule in get_po.custom_delivery_schedule_details:
                    if schedule.name == item.custom_row_id:
                        schedule.received_qty = schedule.received_qty+item.received_qty  
                        
                get_po.save()
                
        frappe.db.commit()
    
    # Create OUT stock entry when GRN is submitted
    # if self.custom_gate_entry_no:
    #     create_out_stock_entry_from_gate_entry(self)

def create_out_stock_entry_from_gate_entry(pr_doc):
    """Create Material Issue stock entry by copying from Gate Entry's IN stock entry"""
    try:
        # Get the Gate Entry's IN stock entry
        gate_entry_stock_entry = frappe.db.get_value(
            "Stock Entry", 
            {"custom_gate_entry": pr_doc.custom_gate_entry_no, "stock_entry_type": "Material Receipt"}, 
            "name"
        )
        
        if not gate_entry_stock_entry:
            frappe.throw(f"No Material Receipt stock entry found for Gate Entry: {pr_doc.custom_gate_entry_no}")
        
        # Get the original IN stock entry
        original_se = frappe.get_doc("Stock Entry", gate_entry_stock_entry)
        
        # Create new OUT stock entry
        new_se = frappe.get_doc({
            "doctype": "Stock Entry",
            "stock_entry_type": "Material Issue",
            "custom_gate_entry": pr_doc.custom_gate_entry_no,
            "purchase_receipt_no": pr_doc.name,
            "company": pr_doc.company,
            "posting_date": pr_doc.posting_date,
            "posting_time": pr_doc.posting_time,
            "items": []
        })
        
        # Copy items but swap target to source
        for item in original_se.items:
            new_se.append("items", {
                "item_code": item.item_code,
                "item_name": item.item_name,
                "qty": item.qty,
                "uom": item.uom,
                "s_warehouse": item.t_warehouse,  # Target becomes Source
                "shelf": item.to_shelf,  # to_shelf becomes shelf
                "expense_account": item.expense_account,
                "allow_zero_valuation_rate": 1
            })
        
        if new_se.items:
            new_se.insert()
            new_se.submit()
            frappe.msgprint(f"Stock Entry {new_se.name} created for material issue")
        
    except Exception as e:
        frappe.log_error(f"Error creating OUT stock entry: {str(e)}")
        frappe.throw(f"Error creating OUT stock entry: {str(e)}")

def check_buying_settings(doc):
    """
    Check Buying Settings to enforce Gate Entry requirement for Purchase Receipt
    """
    allow_grn_without_gate_entry = frappe.db.get_single_value("Buying Settings", "allow_grn_without_gate_entry") or "Yes"

    if allow_grn_without_gate_entry == "No":
        doc.custom_gate_entry_reqd = 1
        check_gate_entry(doc)

def check_gate_entry(doc):
    """
    Validate Gate Entry is mandatory when settings require it
    """
    if not doc.custom_gate_entry_no:
        frappe.throw(
            _("Gate Entry is mandatory for creating Purchase Receipt.<br><br>"
              "<strong>To bypass this validation:</strong><br>"
              "Go to Buying Settings → Enable 'Allow GRN Without Gate Entry'")
        )
