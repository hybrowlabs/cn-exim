// Copyright (c) 2025, Prathamesh Jadhav and contributors
// For license information, please see license.txt

frappe.ui.form.on("BOE Entry", {
    refresh: function (frm) {
        if (frm.doc.docstatus == 1) {
            frm.add_custom_button("e-Waybill", function () {
                let items = []

                frappe.call({
                    method: "cn_exim.cn_exim.doctype.boe_entry.boe_entry.get_items_details",
                    args: {
                        pre_alert_check_list: frm.doc.per_alert_check
                    },
                    callback: function (r) {
                        let data = r.message[0]
                        let parent_date = r.message[1]
                        let total_amount = 0
                        data.forEach(item => {
                            items.push({
                                purchase_order: item.po_no,
                                item_code: item.item_code,
                                item_name: item.material_name,
                                qty: item.quantity,
                                po_qty: item.po_qty,
                                total_inr_value: item.total_amount,
                                rate: item.item_price,
                                amount: item.amount,
                                currency: parent_date[0]['currency'],
                                rate_inr: item.total_amount / item.quantity
                            })
                            total_amount += item.total_amount
                        })
                        frappe.call({
                            method: "frappe.client.insert",
                            args: {
                                doc: {
                                    doctype: "E-way Bill",
                                    select_doctype: frm.doctype,
                                    doctype_id: frm.doc.name,
                                    pre_alert_check_list: frm.doc.per_alert_check,
                                    // total_amount: total_amount,
                                    supplier: parent_date[0]['vendor'],
                                    items: items
                                }
                            },
                            callback: function (r) {
                                frappe.set_route("Form", "E-way Bill", r.message['name'])
                            }
                        })
                    }
                })
            }, __("Create"))

            frm.add_custom_button("Payment Entry", function(){
                let total_amount = frm.doc.bcd_amount + frm.doc.h_cess_amount + frm.doc.sws_amount + frm.doc.igst_amount;
                frappe.model.with_doctype("Payment Entry", function() {
                    let doc = frappe.model.get_new_doc("Payment Entry");
                
                    doc.custom_boe_entry = frm.doc.name;
                    doc.payment_type = "Pay";
                    doc.party_type = "Supplier";
                    doc.paid_from = frm.doc.company;
                    doc.paid_amount = total_amount;
                    doc.currency = frm.doc.currency;
                    doc.received_amount = total_amount;
                
                    frappe.set_route("Form", "Payment Entry", doc.name);
                
                    // Set party after route change to ensure party_type is applied
                    frappe.after_ajax(() => {
                        setTimeout(() => {
                            locals["Payment Entry"][doc.name].party = frm.doc.vendor;
                            frappe.model.set_value("Payment Entry", doc.name, "party", frm.doc.vendor);
                        }, 300); // delay to allow party_type to process
                    });
                });                
                
            }, __("Create"))
        }
    }
})
