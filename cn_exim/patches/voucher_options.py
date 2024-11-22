import frappe
from frappe.custom.doctype.property_setter.property_setter import make_property_setter
def execute():
    create_custom_field()

def create_custom_field():
   if frappe.db.exists("Property Setter", {"doc_type": "Journal Entry", "property": "options"}) :
       doc=frappe.get_doc("Property Setter","Journal Entry-voucher_type-options")
       if "RODTEP Entry" not in doc.value:
           doc.value+="\nRODTEP Entry"
   else:
       data=frappe.db.get_value("DocField", {"fieldname":"voucher_type","fieldtype":"Select"},['options'])
       if "RODTEP Entry" not in data:
           data+="\nRODTEP Entry"
       make_property_setter("Journal Entry","voucher_type","options",data)