import frappe

def on_submit(self, method):
    if self.items:
        for item in self.items:
            if item.purchase_order and item.custom_row_id:
                get_po = frappe.get_doc("Purchase Order", item.purchase_order)
                for schedule in get_po.custom_delivery_schedule_details:
                    if schedule.name == item.custom_row_id:
                        schedule.received_qty = schedule.received_qty+item.received_qty  
                        
                get_po.save()
                
        frappe.db.commit()
