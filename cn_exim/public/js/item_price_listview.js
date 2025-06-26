frappe.listview_settings['Item Price'] = {
    onload: function (listview) {
        listview.page.add_menu_item(__("Bulk Price Approval"), function () {
            let dialog = new frappe.ui.Dialog({
                title: "Create Bulk Item Price",
                fields: [
                    {
                        label: "Add Bulk Item Price",
                        fieldname: "add_bulk_item_price",
                        fieldtype: "Table",
                        reqd: 1,
                        fields: [
                            {
                                label: "Item Code",
                                fieldname: "item_code",
                                fieldtype: "Link",
                                options: "Item",
                                in_list_view: 1,
                            },
                            {
                                label: "Rate",
                                fieldname: "rate",
                                fieldtype: "Float",
                                in_list_view: 1,
                            },
                            {
                                label: "Price List",
                                fieldname: "price_list",
                                fieldtype: "Link",
                                options: "Price List",
                                in_list_view: 1,
                            },
                            {
                                label: "valid_upto",
                                fieldname: "valid_upto",
                                fieldtype: "Date",
                                in_list_view: 1,
                            },
                            {
                                label: "Supplier",
                                fieldname: "supplier",
                                fieldtype: "Link",
                                options: "Supplier",
                                in_list_view: 1,
                            }
                        ]
                    }
                ],
                size: "large",
                primary_action_label: "Create Item Prices",
                primary_action(value) {
                    dialog.hide()
                    frappe.call({
                        method: "cn_exim.config.py.item_price.bulk_create",
                        args: {
                            data: value.add_bulk_item_price
                        },
                        callback:function(r){
                            if(r.message){
                                frappe.show_alert({
                                    message: __("Item Price Created Successfully"),
                                    indicator: "green",
                                }, 5);
                            }
                        }
                    })
                }
            });
            dialog.show()
        });
    }
}
