import frappe

@frappe.whitelist()
def get_po_details_to_gate_entry(gate_entry_name):
    if not gate_entry_name:
        return
    gate_entry = frappe.db.sql(" select * from `tabGate Entry` where name=%s ", [gate_entry_name], as_dict=True)
    gate_entry_chid = frappe.db.sql(" select * from `tabGate Entry Details` where parent=%s ", [gate_entry_name], as_dict=True)

    parent=gate_entry_chid[0]["purchase_order"]
    if not parent:
        frappe.throw("No Purchase Order linked to this Gate Entry.")

    gate_entry_extra_purchase_items=frappe.db.sql("select * from `tabPurchase Extra Charges` where parent=%s",parent,as_dict=True)

    get_purchase_order_details=frappe.db.sql("select * from `tabPurchase Order` where name=%s",[parent],as_dict=True)

    return gate_entry, gate_entry_chid ,gate_entry_extra_purchase_items , get_purchase_order_details



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
    data = frappe.db.sql(" select custom_under_tolerance, custom_over_tolerance,qty,received_qty from `tabPurchase Order Item` where name=%s ", (name), as_dict=True)
    
    return data

@frappe.whitelist()
def get_account(item_code, company):
    data = frappe.db.sql(" select custom_stock_received_but_not_billed, custom_default_inventory_account from `tabItem Default` where parent=%s and company=%s ",(item_code, company), as_dict=True)
    
    return data

@frappe.whitelist()
def validate_qty_for_blanket_order(item_code, name):
    data = frappe.db.sql(" select qty, custom_received_qty from `tabBlanket Order Item` where parent=%s and item_code=%s",(name, item_code),as_dict=True)
    
    return data


@frappe.whitelist()
def update_blanket_order(name, item_code, qty):
    data = frappe.db.sql(" select name, qty, custom_received_qty from `tabBlanket Order Item` where parent=%s and item_code=%s ",(name, item_code), as_dict=True)
    
    remaining_qty = 0
    if data[0]['custom_received_qty'] == 0.0:
        remaining_qty = float(data[0]['qty']) - float(qty)
    else:
        remaining_qty = float(data[0]['custom_received_qty']) + float(qty)
        
    frappe.db.set_value("Blanket Order Item", data[0]['name'], "custom_received_qty", remaining_qty)

@frappe.whitelist()
def get_purchase_order_item_name(item_code, purchase_order):
    data = frappe.db.sql("select name from `tabPurchase Order Item` where item_code=%s and parent=%s ",(item_code, purchase_order), as_dict=True)

    # item_name=data[0]["name"]
    # print(item_name)

    return data  



@frappe.whitelist()
def create_stock_entry_for_stock_issus(doc, warehouse):
    doc = frappe.parse_json(doc)
    
    gate_entry = doc.get("custom_gate_entry_no") or doc.get("name")

    stock_entry = frappe.get_doc({
        "doctype": "Stock Entry",
        "stock_entry_type": "Material Issue",
        "custom_gate_entry": gate_entry,
        "items": []
    })

    doc_list = doc.get("gate_entry_details") or doc.get("items") or []

    for item in doc_list:
        item_code = item.get("item") or item.get("item_code")
        if not item_code:
            continue  # Skip if no item code

        stock_entry.append("items", {
            "item_code": item_code,
            "item_name": item.get("item_name"),
            "qty": item.get("qty"),
            "uom": item.get("uom"),
            "s_warehouse": warehouse,
            "expense_account": frappe.db.get_value("Item Default", {"parent": item_code}, "custom_difference_account"),
            "allow_zero_valuation_rate": 1
        })

    stock_entry.insert()
    stock_entry.submit()
    
    
@frappe.whitelist()
def update_gate_entry_and_purchase_order(name, doc):
    frappe.db.set_value("Gate Entry", name, "grn_created", 1)
    
    items = frappe.parse_json(doc).get("items", [])
    
    for item in items:
        purchase_order_item = item.get("purchase_order_item")
        gate_received_qty = frappe.db.sql(" select qty from `tabGate Entry Details` where parent=%s and item=%s", (name, item.get("item_code")), as_dict=True)
        received_qty = gate_received_qty[0].get("qty") if gate_received_qty else 0.0
        if purchase_order_item:
            gate_entry_qty = frappe.db.get_value(
                "Purchase Order Item", purchase_order_item, "custom_gate_entry_qty"
            ) or 0.0

            updated_qty = gate_entry_qty - received_qty
            frappe.db.set_value(
                "Purchase Order Item", purchase_order_item, "custom_gate_entry_qty", updated_qty
            )

        
