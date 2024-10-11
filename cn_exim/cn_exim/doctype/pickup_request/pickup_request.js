// Copyright (c) 2024, Prathamesh Jadhav and contributors
// For license information, please see license.txt

frappe.ui.form.on("Pickup Request", {
	refresh(frm) {
        // frm.set_query("supplier_address", erpnext.queries.address_query);
	},
    custom_get_po_items:function(frm){
        frappe.call({
            "method":"get_items",
            doc:frm.doc,
            args:{
                po:frm.doc.purchase_order_list,
            },
            callback:function(r){
                frm.refresh()
            }

        })
    }
});
