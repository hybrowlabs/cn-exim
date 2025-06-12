import frappe

@frappe.whitelist()
def get_supplier_previously_data(item_code):
    # Get all suppliers who have created Purchase Orders for the given item
    suppliers = frappe.db.sql("""
        SELECT DISTINCT supplier
        FROM `tabPurchase Order`
        WHERE docstatus = 1 AND name IN (
            SELECT parent FROM `tabPurchase Order Item` WHERE item_code = %s
        )
    """, (item_code,), as_dict=True)

    result = {}

    for supplier_entry in suppliers:
        supplier = supplier_entry.supplier

        # Get the latest PO for this supplier and item
        po = frappe.db.sql("""
            SELECT name
            FROM `tabPurchase Order`
            WHERE supplier = %s AND docstatus = 1
            ORDER BY transaction_date DESC, creation DESC
            LIMIT 1
        """, (supplier,), as_dict=True)

        if po:
            po_name = po[0].name

            # Get the PO Item details for this supplier and item
            data = frappe.db.sql("""
                SELECT rate, qty, received_qty
                FROM `tabPurchase Order Item`
                WHERE parent = %s AND item_code = %s
            """, (po_name, item_code), as_dict=True)

            if data:
                result[supplier] = data[0]  # Store the first item’s data under the supplier

    return result

