# Copyright (c) 2024, Prathamesh Jadhav and contributors
# For license information, please see license.txt

import frappe
from frappe.model.document import Document


class MaterialTypes(Document):
	def validate(self):
		self.validate_shelf()

	def validate_shelf(self):
		if self.shelf:
			if not self.warehouse:
				frappe.throw("Warehouse is required")
			else:
				valid_warehouse = frappe.db.get_value("Shelf",self.shelf,"warehouse")
				if valid_warehouse != self.warehouse:
					frappe.throw("Wrong Parent Warehouse")

@frappe.whitelist()
def get_Charges_of_item(name):
    data = frappe.db.sql(" select * from `tabItem Charges Template` where parent=%s ",(name), as_dict=True)
    
    return data
