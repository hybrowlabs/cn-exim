// Copyright (c) 2024, Prathamesh Jadhav and contributors
// For license information, please see license.txt

frappe.ui.form.on("E-way Bill", {
    refresh: function (frm) {
        frm.set_query("transporter", function () {
            return {
                filters: {
                    is_transporter: 1
                }
            }
        })
        frm.set_query("bill_of_entry", function () {
            return {
                filters: {
                    docstatus: 1
                }
            }
        })
        frm.set_query('supplier_address', function (doc) {
            return {
                query: 'frappe.contacts.doctype.address.address.address_query',
                filters: {
                    link_doctype: 'Supplier',
                    link_name: doc.supplier
                }
            };
        });

        frm.add_custom_button("e-waybill", function(){
            alert("this button call")
        })
    },
    bill_of_entry: function (frm) {
        frappe.call({
            method: "cn_exim.cn_exim.doctype.e_way_bill.e_way_bill.get_items_details",
            args: {
                name: frm.doc.bill_of_entry,
                pre_alert_name: frm.doc.pre_alert_check_list
            },
            callback: function (r) {

                let items_data = r.message[2]
                let total_amount = 0
                items_data.forEach(item => {
                    let total_charge = item.bcd_amount + item.hcs_amount + item.swl_amount + item.igst_amount
                    let row = frm.add_child("e_waybill_items")
                    row.purchase_order = item.po_no
                    row.item_code = item.item_code
                    row.item_name = item.material_name
                    row.order_quantity = item.quantity
                    row.total_inr_value = item.total_amount
                    row.total_charges_of_types = total_charge
                    total_amount += item.total_amount
                })
                frm.refresh_field("e_waybill_items")
                frm.set_value("total_amount", total_amount)
            }
        })
    },
    supplier_address: function (frm) {
        erpnext.utils.get_address_display(frm, "supplier_address", "address", false);
    },
    bill_from: function (frm) {
        erpnext.utils.get_address_display(frm, "bill_from", "bill_from_address", false)
    },
    bill_to: function (frm) {
        erpnext.utils.get_address_display(frm, "bill_to", "bill_to_address", false)
    },
    ship_from: function (frm) {
        erpnext.utils.get_address_display(frm, "ship_from", "ship_from_address", false)
    },
    ship_to: function (frm) {
        erpnext.utils.get_address_display(frm, "ship_to", "ship_to_address", false)
    }
});
