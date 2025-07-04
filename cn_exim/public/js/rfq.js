frappe.ui.form.on("Request for Quotation", {
    custom_shipment_address: function (frm) {
        erpnext.utils.get_address_display(frm, "custom_shipment_address", "custom_shipment_address_details", false);
    },
    billing_address: function (frm) {
        erpnext.utils.get_address_display(frm, "billing_address", "billing_address_display", false);
    },
    custom_currency_name: function (frm) {
        frappe.call({
            method: "erpnext.setup.utils.get_exchange_rate",
            args: {
                from_currency: frm.doc.custom_currency_name,
                to_currency: "INR",
                transaction_date: frappe.datetime.get_today()
            },
            callback: function (r) {
                frm.set_value("custom_currency", r.message)
            }
        })
    },
    custom_pickup_request: function (frm) {
        frappe.call({
            method: "cn_exim.cn_exim.api.get_api_list",
            args: {
                pr: frm.doc.custom_pickup_request
            },
            callback: function (r) {

                var data = r.message[2]
                data.forEach(function (obj) {
                    var row = frm.add_child("custom_purchase_order")
                    row.purchase_order = obj.po_number
                })
                frm.refresh_field("custom_purchase_order")
            }
        })
    },
    custom_select_service: function (frm) {
        frappe.call({
            method: "cn_exim.cn_exim.api.supplier_quotation",
            args: {
                service: frm.doc.custom_select_service
            },
            callback: function (r) {

                if (r.message) {
                    frm.set_query('supplier', 'suppliers', (doc, cdt, cdn) => {
                        return {
                            filters: [
                                ['Supplier', 'name', 'in', r.message]
                            ]
                        };
                    })
                }
            }
        })
    },
    on_submit: function (frm) {
        frm.doc.items.forEach(function (item) {
            if (item.material_request_item) {
                frappe.call({
                    method: "frappe.client.set_value",
                    args: {
                        doctype: "Material Request Item",
                        name: item.material_request_item,
                        fieldname: "custom_rfq_created",
                        value: 1
                    },
                    callback: function (r) {
                        // Optional: You can handle success or log here
                        console.log("Updated:", item.material_request_item);
                    }
                });
            }
        });
    },
    after_cancel: function (frm) {
        frm.doc.items.forEach(function (item) {
            if (item.material_request_item) {
                frappe.call({
                    method: "frappe.client.set_value",
                    args: {
                        doctype: "Material Request Item", // ✅ fixed casing
                        name: item.material_request_item,
                        fieldname: "custom_rfq_created",
                        value: 0
                    },
                    callback: function (r) {
                        console.log("custom_rfq_created reset for", item.material_request_item);
                    }
                });
            }
        });
    }
})