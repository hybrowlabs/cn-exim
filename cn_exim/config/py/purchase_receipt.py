import frappe

@frappe.whitelist()
def get_po_details_to_gate_entry(gate_entry_name):
    
    gate_entry = frappe.db.sql(" select * from `tabGate Entry` where name=%s ", (gate_entry_name), as_dict=True)
    gate_entry_chid = frappe.db.sql(" select * from `tabGate Entry Details` where parent=%s ", (gate_entry_name), as_dict=True)
    
    return gate_entry, gate_entry_chid