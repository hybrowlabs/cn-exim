frappe.ui.form.on("Request for Quotation", {
    custom_shipment_address: function (frm) {
        erpnext.utils.get_address_display(frm, "custom_shipment_address", "custom_shipment_address_details", false);
    },
    billing_address: function (frm) {
        erpnext.utils.get_address_display(frm, "billing_address", "billing_address_display", false);
    },
    custom_pickup_request: function (frm) {
        frappe.call({
            method: "cn_exim.cn_exim.api.get_api_list",
            args: {
                pr: frm.doc.custom_pickup_request
            },
            callback: function (r) {

                if (r.message) {
                    // frm.clear_table("suppliers")
                    frm.clear_table("items")
                    // var d = frm.add_child("suppliers");
                    // frappe.model.set_value(d.doctype, d.name, 'supplier', r.message[0]);
                    // frm.refresh_fields("suppliers")

                    $.each(r.message[1], function (i, m) {
                        var child = frm.add_child("items");
                        frappe.model.set_value(child.doctype, child.name, 'item_code', m.item);
                        frappe.model.set_value(child.doctype, child.name, 'qty', m.pick_qty);



                    })




                }
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
    // create a doctype for supplier quotation on rfq is submit
    on_submit:function(fmr){
        frm.doc.suppliers.forEach(item =>{
            frappe.call({
                method:'frappe.client.insert',
                args:{
                    doc:{
                        'doctype':"Supplier Quotation",
                        'supplier':
                        'custom_pickup_request':
                        'custom_type':
                        
                    }
                }
            })
        })
    }
})