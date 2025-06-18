import frappe

@frappe.whitelist()
def get_item_charges(name):
    data = frappe.db.sql("""
                SELECT ict.*, mt.item_charges
                FROM `tabItem Charges Template` ict
                JOIN `tabMaterial Types` mt ON ict.parent = mt.name
                WHERE ict.parent = %s
    """, (name,), as_dict=True)

    return data


@frappe.whitelist()
def get_item_charges_from_item_group(name):
    data = frappe.db.sql("""
                SELECT ict.*, ig.custom_item_charge
                FROM `tabItem Charges Template` ict
                JOIN `tabItem Group` ig ON ict.parent = ig.name
                WHERE ict.parent = %s
    """, (name,), as_dict=True)

    return data

@frappe.whitelist()
def get_default_account(name):
    data = frappe.db.sql(" select * from `tabMaterial Type Account` where parent=%s ",(name), as_dict=True)
    
    return data

@frappe.whitelist()
def get_default_account_form_key_based_on_material_type(name, account_key, company):
    doc_name = frappe.db.get_value("Key Ledger Group", {"material_group": name}, "name")
    
    data = frappe.db.sql(" select * from `tabKey Ledger Group Details` where parent=%s and `key`=%s and company=%s", (doc_name, account_key, company), as_dict=True)
    
    return data
