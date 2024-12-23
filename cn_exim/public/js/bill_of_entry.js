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
                        let data = r.message[0]
                        let parent_date = r.message[1]
                        let total_amount = 0
                        data.forEach(item => {
                            items.push({
                                purchase_order: item.po_no,
                                item_code: item.item_code,
                                item_name: item.material_name,
                                qty: item.quantity,
                                total_inr_value: item.total_amount,
                            })
                            total_amount += item.total_amount
                        })
                        frappe.call({
                            method: "frappe.client.insert",
                            args: {
                                doc: {
                                    doctype: "E-way Bill",
                                    select_doctype:frm.doctype,
                                    doctype_id: frm.doc.name,
                                    pre_alert_check_list: frm.doc.custom_prealert_check_list,
                                    total_amount: total_amount,
                                    supplier:parent_date[0]['vendor'],
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
        }
        frm.remove_custom_button('Landed Cost Voucher', 'Create');
        frm.remove_custom_button('Journal Entry for Payment', 'Create')
    }
})