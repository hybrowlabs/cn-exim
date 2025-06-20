import frappe
from erpnext.stock.doctype.delivery_note.delivery_note import DeliveryNote
from erpnext.controllers.status_updater import StatusUpdater

def custom_limits_crossed_error(self, args, item, qty_or_amount):
    # Your custom logic here (copied or modified from original)
    if self.doctype in ["Purchase Receipt"]:
        return
    if (
        self.doctype in ["Sales Invoice", "Delivery Note"]
        and qty_or_amount == "amount"
        and self.is_internal_customer
    ):
        return

    elif (
        self.doctype in ["Purchase Invoice", "Purchase Receipt"]
        and qty_or_amount == "amount"
        and self.is_internal_supplier
    ):
        return

    # Customize message or action
    if qty_or_amount == "qty":
        action_msg = "Over qty limit! Contact Warehouse Manager."
    else:
        action_msg = "Billing limit exceeded! Contact Accounts."

    frappe.throw(
        "Custom Error: Limit crossed for item {0} in {1}".format(
            item.get("item_code"), self.doctype
        ) + "<br><br>" + action_msg,
        title="Custom Limit Crossed"
    )

# Patch the method
StatusUpdater.limits_crossed_error = custom_limits_crossed_error
