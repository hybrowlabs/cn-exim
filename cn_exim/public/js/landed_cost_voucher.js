frappe.ui.form.on("Landed Cost Voucher", {
    custom_get_purchase_invoice: function (frm, cdt, cdn) {
        let data = locals[cdt][cdn]
        let firstReceipt = data.purchase_receipts[0]['receipt_document'];
        frappe.call({
            method: "frappe.client.get_list",
            args: {
                doctype: "Purchase Invoice",
                filters: {
                    custom_purchase_receipt: firstReceipt,
                    docstatus: 1
                },
                fields: ['name', 'supplier', 'grand_total', 'posting_date']
            },
            callback: function (r) {
                let data = r.message
                data.forEach(item => {
                    frappe.call({
                        method: "cn_exim.config.py.landed_cost_voucher.get_purchase_invoice_item",
                        args: {
                            name: item.name
                        },
                        callback: function (r) {
                            let row = frm.add_child("custom_purchase_invoice_details")
                            row.purchase_invoice = item.name
                            row.supplier = item.supplier
                            row.amount = item.grand_total
                            row.date = item.posting_date
                            row.item = r.message[0]['item_code']
                            frm.refresh_field("custom_purchase_invoice_details")
                        }
                    })
                })
            }
        })
    },
})
