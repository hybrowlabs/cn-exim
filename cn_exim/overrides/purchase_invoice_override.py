import frappe
import erpnext
from erpnext.accounts.doctype.purchase_invoice.purchase_invoice import get_warehouse_account_map, is_cwip_accounting_enabled, get_asset_category_account, get_link_to_form
from frappe import _, qb, throw
from erpnext.accounts.doctype.purchase_invoice.purchase_invoice import make_regional_gl_entries
from erpnext.accounts.doctype.purchase_invoice.purchase_invoice import merge_similar_entries

def custom_set_expense_account(self, for_validate=False):
		auto_accounting_for_stock = erpnext.is_perpetual_inventory_enabled(self.company)
		if auto_accounting_for_stock:
			for item in self.items:
				data = frappe.db.sql(" select custom_stock_received_but_not_billed, custom_default_inventory_account from `tabItem Default` where parent=%s and company=%s ",(item.item_code, self.company), as_dict=True)

				account = data[0]['custom_stock_received_but_not_billed']
				stock_items = self.get_stock_items()

				if account:
					stock_not_billed_account = account
					item.expense_account = account
					item.custom_srbnb_account = account
				else:
					if(account == None):
					# Fallback to default ERPNext behavior
					# item.expense_account = account
						
						retrieve_account_head=frappe.db.sql("select account_head, supplier from `tabPurchase Extra Charges` where  item_code=%s and parent=%s",(item.item_code,self.custom_purchase_order), as_dict=True)
						account=retrieve_account_head[0]["account_head"]
						 
						valid_account = frappe.db.exists("Account", {"name": account, "company": self.company})
						if  not valid_account:
							frappe.throw(_("Row {0}: Expense Account {1} does not belong to Company {2}. Please check your account settings.").format(item.idx, frappe.bold(account), frappe.bold(self.company)))
						item.expense_account=valid_account
					# else:
					# 	item.expense_account=account
					

		self.asset_received_but_not_billed = None

		if self.update_stock:
			self.validate_item_code()
			self.validate_warehouse(for_validate)
			if auto_accounting_for_stock:
				warehouse_account = get_warehouse_account_map(self.company)

		for item in self.get("items"):
			# in case of auto inventory accounting,
			# expense account is always "Stock Received But Not Billed" for a stock item
			# except opening entry, drop-ship entry and fixed asset items
			if (
				auto_accounting_for_stock
				and item.item_code in stock_items
				and self.is_opening == "No"
				and not item.is_fixed_asset
				and (
					not item.po_detail
					or not frappe.db.get_value("Purchase Order Item", item.po_detail, "delivered_by_supplier")
				)
			):
				if self.update_stock and item.warehouse and (not item.from_warehouse):
					if (
						for_validate
						and item.expense_account
						and item.expense_account != warehouse_account[item.warehouse]["account"]
					):
						msg = _(
							"Row {0}: Expense Head changed to {1} because account {2} is not linked to warehouse {3} or it is not the default inventory account"
						).format(
							item.idx,
							frappe.bold(warehouse_account[item.warehouse]["account"]),
							frappe.bold(item.expense_account),
							frappe.bold(item.warehouse),
						)
						frappe.msgprint(msg, title=_("Expense Head Changed"))
					item.expense_account = warehouse_account[item.warehouse]["account"]
				else:
					# check if 'Stock Received But Not Billed' account is credited in Purchase receipt or not
					data = frappe.db.sql(" select custom_stock_received_but_not_billed, custom_default_inventory_account from `tabItem Default` where parent=%s and company=%s ",(item.item_code, self.company), as_dict=True)
					stock_not_billed_account = data[0]['custom_stock_received_but_not_billed']
					if item.purchase_receipt:
						print("\n\n\n purchase receipt", item.purchase_receipt, "\n\n\n")
						negative_expense_booked_in_pr = frappe.db.sql(
							"""select name from `tabGL Entry`
							where voucher_type='Purchase Receipt' and voucher_no=%s and account = %s""",
							(item.purchase_receipt, stock_not_billed_account),
						)

    
						print("\n\n\n", negative_expense_booked_in_pr, "\n\n\n")
						if negative_expense_booked_in_pr:
							if (
								for_validate
								and item.expense_account
								and item.expense_account != stock_not_billed_account
							):
								msg = _(
									"Row {0}: Expense Head changed to {1} because expense is booked against this account in Purchase Receipt {2}"
								).format(
									item.idx,
									frappe.bold(stock_not_billed_account),
									frappe.bold(item.purchase_receipt),
								)
								frappe.msgprint(msg, title=_("Expense Head Changed"))

							item.expense_account = stock_not_billed_account
					else:
						# If no purchase receipt present then book expense in 'Stock Received But Not Billed'
						# This is done in cases when Purchase Invoice is created before Purchase Receipt
						if (
							for_validate
							and item.expense_account
							and item.expense_account != stock_not_billed_account
						):
							msg = _(
								"Row {0}: Expense Head changed to {1} as no Purchase Receipt is created against Item {2}."
							).format(
								item.idx, frappe.bold(stock_not_billed_account), frappe.bold(item.item_code)
							)
							msg += "<br>"
							msg += _(
								"This is done to handle accounting for cases when Purchase Receipt is created after Purchase Invoice"
							)
							frappe.msgprint(msg, title=_("Expense Head Changed"))
						if(stock_not_billed_account):
							item.expense_account = stock_not_billed_account							


			elif item.is_fixed_asset:
				account = None
				if not item.pr_detail and item.po_detail:
					receipt_item = frappe.get_cached_value(
						"Purchase Receipt Item",
						{
							"purchase_order": item.purchase_order,
							"purchase_order_item": item.po_detail,
							"docstatus": 1,
						},
						["name", "parent"],
						as_dict=1,
					)
					if receipt_item:
						item.pr_detail = receipt_item.name
						item.purchase_receipt = receipt_item.parent

				if item.pr_detail:
					if not self.asset_received_but_not_billed:
						self.asset_received_but_not_billed = self.get_company_default(
							"asset_received_but_not_billed"
						)

					# check if 'Asset Received But Not Billed' account is credited in Purchase receipt or not
					arbnb_booked_in_pr = frappe.db.get_value(
						"GL Entry",
						{
							"voucher_type": "Purchase Receipt",
							"voucher_no": item.purchase_receipt,
							"account": self.asset_received_but_not_billed,
						},
						"name",
					)
					if arbnb_booked_in_pr:
						account = self.asset_received_but_not_billed

				if not account:
					account_type = (
						"capital_work_in_progress_account"
						if is_cwip_accounting_enabled(item.asset_category)
						else "fixed_asset_account"
					)
					account = get_asset_category_account(
						account_type, item=item.item_code, company=self.company
					)
					if not account:
						form_link = get_link_to_form("Asset Category", item.asset_category)
						throw(
							_("Please set Fixed Asset Account in {} against {}.").format(
								form_link, self.company
							),
							title=_("Missing Account"),
						)
				item.expense_account = account
			elif not item.expense_account and for_validate:
				throw(_("Expense account is mandatory for item {0}").format(item.item_code or item.item_name))




def custom_get_gl_entries(self, warehouse_account=None):
    self.auto_accounting_for_stock = erpnext.is_perpetual_inventory_enabled(self.company)

    if self.auto_accounting_for_stock:
        self.stock_received_but_not_billed = None  # Default value

        for item in self.items:
            data = frappe.db.sql("""
                SELECT custom_stock_received_but_not_billed, custom_default_inventory_account
                FROM `tabItem Default`
                WHERE parent=%s AND company=%s
            """, (item.item_code, self.company), as_dict=True)

            if data:  # ✅ Ensure data exists
                self.stock_received_but_not_billed = data[0].get("custom_stock_received_but_not_billed")
                if self.stock_received_but_not_billed:
                    break  # ✅ Stop once we get a valid value

    else:
        self.stock_received_but_not_billed = None

    self.negative_expense_to_be_booked = 0.0
    gl_entries = []

    # ✅ Call the standard GL entry functions
    self.make_supplier_gl_entry(gl_entries)
    self.make_item_gl_entries(gl_entries)
    self.make_precision_loss_gl_entry(gl_entries)
    self.make_tax_gl_entries(gl_entries)
    self.make_internal_transfer_gl_entries(gl_entries)
    self.make_gl_entries_for_tax_withholding(gl_entries)

    # ✅ Regional GL Entries (if applicable)
    gl_entries = make_regional_gl_entries(gl_entries, self)

    # ✅ Merge duplicate GL Entries for efficiency
    gl_entries = merge_similar_entries(gl_entries)

    # ✅ Handle payment-related GL entries
    self.make_payment_gl_entries(gl_entries)
    self.make_write_off_gl_entry(gl_entries)
    self.make_gle_for_rounding_adjustment(gl_entries)

    return gl_entries


