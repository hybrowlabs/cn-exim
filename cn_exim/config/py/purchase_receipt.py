import frappe

@frappe.whitelist()
def get_po_details_to_gate_entry(gate_entry_name):
    
    gate_entry = frappe.db.sql(" select * from `tabGate Entry` where name=%s ", (gate_entry_name), as_dict=True)
    gate_entry_chid = frappe.db.sql(" select * from `tabGate Entry Details` where parent=%s ", (gate_entry_name), as_dict=True)
    
    return gate_entry, gate_entry_chid

# create stock entry for the deduct stock to temporary warehouse
@frappe.whitelist()
def create_stock_entry(doc, gate_entry, warehouse):
    doc = frappe.json.loads(doc)
    
    
    stock_entry = frappe.get_doc({
        "doctype":"Stock Entry",
        "stock_entry_type": "Material Issue",
        "custom_gate_entry": gate_entry,
        "items":[]
    })
    
    for item in doc['items']:
        stock_entry.append("items",{
            "item_code" : item['item_code'],
            "item_name" : item['item_name'],
            "qty": item['qty'],
            "uom": item['uom'],
            "s_warehouse": warehouse
        })
        
    stock_entry.insert()
    stock_entry.submit()
    
@frappe.whitelist()
def validate_tolerance(name):
    data = frappe.db.sql(" select custom_under_tolerance, custom_over_tolerance,qty from `tabPurchase Order Item` where name=%s ", (name), as_dict=True)
    
    return data