import frappe
from frappe import _


def execute(filters=None):
	columns, data = get_columns(), get_data()
	return columns, data


def get_columns():
    return [
		{"label": _("Purchase Requisition"), "fieldname":"purchase_requisition", "fieldtype":"Link", "options":"Material Request", "width":150},
		{"label": _("Requisitioner"), "fieldname":"custom_requisitioner", "fieldtype":"Link", "options":"Material Request", "width":150},
		{"label": _("Request Date"), "fieldname":"transaction_date", "fieldtype":"Link", "options":"Material Request", "width":150},
		{"label": _("Company"), "fieldname":"company", "fieldtype":"Link", "options":"Material Request", "width":150},
		{"label": _("Aging Days"), "fieldname":"aging_days", "fieldtype":"Link", "options":"Material Request", "width":150},
	]
    
    
def get_data():
    return frappe.db.sql("""
			SELECT 
				name as purchase_requisition,
				custom_requisitioner as custom_requisitioner,
				company as company, 
				transaction_date as transaction_date,
				DATEDIFF(CURDATE(), transaction_date) AS aging_days
			FROM 
				`tabMaterial Request` 
			WHERE 
				status IN ("Draft", "Pending") 
				AND material_request_type = "Purchase"
			ORDER BY 
				DATEDIFF(CURDATE(), transaction_date) DESC
		""", as_dict=True)
	

	
	