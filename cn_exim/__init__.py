__version__ = "0.0.1"

from cn_exim.overrides import e_waybill_override
from cn_exim.overrides import e_waybill_class_override
from cn_exim.overrides import purchase_receipt_override
from cn_exim.overrides import purchase_invoice_override
from india_compliance.gst_india.utils.e_waybill import EWaybillData
import india_compliance.gst_india.utils.e_waybill as e_waybill
from erpnext.stock.doctype.purchase_receipt.purchase_receipt import PurchaseReceipt
from erpnext.accounts.doctype.purchase_invoice.purchase_invoice import PurchaseInvoice

#  This all class and function override for the e-way bill generate
EWaybillData.get_transaction_data = e_waybill_class_override.custom_get_transaction_data
EWaybillData.update_transaction_details = e_waybill_class_override.custom_update_transaction_details
EWaybillData.validate_doctype_for_e_waybill=e_waybill_override.custom_validate_doctype_for_e_waybill
EWaybillData.validate_applicability=e_waybill_override.custom_validate_applicability
e_waybill.get_address_map = e_waybill_override.custom_get_address_map


# This class override for the change account in purchase receipt in buying
PurchaseReceipt.make_item_gl_entries = purchase_receipt_override.custom_make_item_gl_entries

# this call override for the change account in purchase invoice in buying
PurchaseInvoice.set_expense_account = purchase_invoice_override.custom_set_expense_account
PurchaseInvoice.get_gl_entries = purchase_invoice_override.custom_get_gl_entries
