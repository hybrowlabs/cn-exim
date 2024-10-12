# Copyright (c) 2024, Prathamesh Jadhav and contributors
# For license information, please see license.txt

import frappe
from frappe.model.document import Document


class PreAlert(Document):
	pass


@frappe.whitelist()
def get_percentage_of_hsn_and_category_base(name, category):
		data = frappe.db.sql(" select * from `tabApplication Bond Duty Details` where parent=%s and category=%s ",(name, category), as_dict=True)

		return data