// Copyright (c) 2024, Prathamesh Jadhav and contributors
// For license information, please see license.txt

frappe.ui.form.on("Pickup Request", {
	refresh(frm) {
        frm.set_query('supplier_address', function(doc) {
			return {
				query: 'frappe.contacts.doctype.address.address.address_query',
				filters: {
					link_doctype: 'Supplier',
					link_name: doc.name_of_supplier
				}
			};
		});
        frm.set_query('billing_address', function(doc) {
			return {
				query: 'frappe.contacts.doctype.address.address.address_query',
				filters: {
					link_doctype: 'Company',
					link_name: doc.company
				}
			};
		})
        frm.set_query('pickup_address', function(doc) {
			return {
				query: 'frappe.contacts.doctype.address.address.address_query',
				filters: {
					link_doctype: 'Supplier',
					link_name: doc.name_of_supplier
				}
			};
		});
		frm.set_query('name_of_supplier', function () {
            return {
                filters: {
                    'supplier_group': ['!=',"CHA"]
                }
            }
        })
	},
    supplier_address:function(frm) {
        erpnext.utils.get_address_display(frm, "supplier_address", "supplier_address_display",false);
	},
    billing_address:function(frm) {
        erpnext.utils.get_address_display(frm, "billing_address", "billing_address_display",false);
	},
    supplier_pickup_address:function(frm) {
        erpnext.utils.get_address_display(frm, "supplier_pickup_address", "pickup_address",false);
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
    },
    before_save:function(frm){
        var total_amount = 0
        frm.doc.purchase_order_details.forEach( item =>{
            total_amount += item.amount
        })
        frm.set_value("total_amount", total_amount)
    }
});
