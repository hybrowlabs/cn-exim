# Copyright (c) 2024, goblin and contributors
# For license information, please see license.txt

import frappe
from frappe.core.doctype.server_script.server_script import ServerScript
from frappe.model.document import Document
from frappe.utils.safe_exec import safe_exec


class BatchNumberTemplate(ServerScript):
	def validate(self):
		pass
	def on_update(self):
		pass

def exec_py_exp(py_exp, variables):
    py_exp = py_exp.replace('\n', '\n  ')
    py_exp = "def returned_function(variables):\n  " + py_exp
    _g, _l = safe_exec(py_exp)
    returned_function = _g.get("returned_function")
    return returned_function(variables)

@frappe.whitelist(allow_guest=True)
def create_batch_number(doc, variables={}):
	variables["doc"] = doc
	plant = frappe.get_doc("Plant",doc.custom_plant)
	batch_number_template = frappe.get_doc("Batch Number Template", plant.batch_number_template)
	return exec_py_exp(batch_number_template.batch_number_logic, variables)
