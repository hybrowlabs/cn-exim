frappe.ui.form.on("Bill of Entry", {
    refresh: function (frm) {
        if (frm.doc.docstatus == 1) {
            frm.add_custom_button("e-Waybill", function () {
                let items = []

                frappe.call({
                    method: "cn_exim.config.py.bill_of_entry.get_items_details",
                    args: {
                        pre_alert_check_list: frm.doc.custom_prealert_check_list
                    },
                    callback: function (r) {
                        let data = r.message
                        let total_amount = 0
                        data.forEach(item => {
                            let total_charge = item.bcd_amount + item.hcs_amount + item.swl_amount + item.igst_amount
                            items.push({
                                purchase_order: item.po_no,
                                item_code: item.item_code,
                                item_name: item.material_name,
                                order_quantity: item.quantity,
                                total_inr_value: item.total_amount,
                                total_charges_of_types: total_charge,
                            })
                            total_amount += item.total_amount
                        })
                        frappe.call({
                            method: "frappe.client.insert",
                            args: {
                                doc: {
                                    doctype: "E-way Bill",
                                    bill_of_entry: frm.doc.name,
                                    pre_alert_check_list: frm.doc.custom_prealert_check_list,
                                    total_amount: total_amount,
                                    e_waybill_items: items
                                }
                            },
                            callback: function (r) {
                                frappe.set_route("Form", "E-way Bill", r.message['name'])
                            }
                        })
                    }
                })

            }, __("Create"))
        }
        frm.remove_custom_button('Landed Cost Voucher', 'Create');
        frm.remove_custom_button('Journal Entry for Payment', 'Create')
    }
})