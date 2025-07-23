import frappe
from frappe.utils import getdate, flt
from erpnext.stock.doctype.item.item import get_purchase_voucher_details

def get_last_purchase_details_with_supplier(item_code, doc_name=None, conversion_rate=1.0):

	po = get_purchase_voucher_details("Purchase Order", item_code, doc_name)
	pr = get_purchase_voucher_details("Purchase Receipt", item_code, doc_name)
	pi = get_purchase_voucher_details("Purchase Invoice", item_code, doc_name)

	po_date = getdate(po[0].transaction_date) if po else getdate("1900-01-01")
	pr_date = getdate(pr[0].posting_date) if pr else getdate("1900-01-01")
	pi_date = getdate(pi[0].posting_date) if pi else getdate("1900-01-01")

	last = None
	voucher_type = None

	if po and po_date >= pr_date and po_date >= pi_date:
		last = po[0]
		voucher_type = "Purchase Order"
	elif pr and pr_date >= po_date and pr_date >= pi_date:
		last = pr[0]
		voucher_type = "Purchase Receipt"
	elif pi:
		last = pi[0]
		voucher_type = "Purchase Invoice"

	if not last:
		return frappe._dict()

	# Fetch supplier separately using parent document
	supplier = frappe.db.get_value(voucher_type, last.name, "supplier")

	conversion_factor = flt(last.conversion_factor or 1.0)
	conversion_rate = flt(conversion_rate or 1.0)

	return frappe._dict({
		"supplier": supplier,
		"base_rate": flt(last.base_rate) / conversion_factor,
		"rate": flt(last.base_rate) / conversion_factor / conversion_rate,
		"posting_date": last.get("posting_date") or last.get("transaction_date")
	})

