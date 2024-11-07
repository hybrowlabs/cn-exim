frappe.ui.form.on("Item", {
    custom_material_type: function (frm) {
        if (frm.doc.custom_material_type != undefined) {
            frappe.call({
                method:"frappe.client.get_list",
                args:{
                    "doctype":"Material Types",
                    filters:{
                        'name':frm.doc.custom_material_type
                    },
                    fields:['account_refrence']
                },
                callback:function(r){
                    var account_reference = r.message[0]['account_refrence']
                    frm.set_query("valuation_classes", "custom_plant_details", function () {
                        return {
                            filters: {
                                "account_category_refrence": account_reference
                            }
                        }
                    })
                }
            })
        }
    }
})