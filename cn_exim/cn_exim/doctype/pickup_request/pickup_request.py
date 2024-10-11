# Copyright (c) 2024, Prathamesh Jadhav and contributors
# For license information, please see license.txt

import json
import frappe
from frappe.model.document import Document


class PickupRequest(Document):
	@frappe.whitelist()
	def get_items(self,po):
		self.purchase_order_details=[]
		for i in po:
			doc=frappe.get_doc("Purchase Order",i.get("po_number"))
			for j in doc.items:
				self.append("purchase_order_details",{
					"item":j.item_code,
					"material":j.item_name,
					"quantity":j.qty,
					"po_number":i.get("po_number"),
					"material_desc":j.description
				})

