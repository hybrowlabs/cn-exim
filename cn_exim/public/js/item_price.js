frappe.ui.form.on("Item Price", {
    refresh: function (frm) {
        frm.add_custom_button("Update Rate In Po", function () {
            let d = new frappe.ui.Dialog({
                title: "Update Rate In PO",
                fields: [
                    {
                        fieldtype: "Table",
                        fieldname: "po_details",
                        label: "PO Details",
                        fields: [
                            {
                                fieldtype: "Link",
                                fieldname: "purchase_order",
                                label: "Purchase Order",
                                options: "Purchase Order",
                                in_list_view: 1
                            },
                            {
                                fieldtype: "Link",
                                fieldname: "item_code",
                                label: "Item",
                                options: "Item",
                                in_list_view: 1
                            },
                        ],
                        get_data: function () {
                            return [];
                        }
                    }
                ],
                primary_action_label: 'Update',
                primary_action(values) {
                    console.log('Dialog Values:', values);
                    frappe.call({
                        method: "cn_exim.config.py.item_price.update_po_rate",
                        args:{
                            po_details: values.po_details,
                            rate: frm.doc.price_list_rate
                        }
                    })
                    d.hide();
                }
            });

            d.show();
        })
    }
})