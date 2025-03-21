frappe.ui.form.on("Item Group", {
    // custom_item_charge:function(frm){
    //     frappe.call({
    //         method:"cn_exim.config.py.item_group.get_item_charges",
    //         args:{
    //             name:frm.doc.custom_item_charge
    //         },
    //         callback:function(response){
    //             let data = response.message

    //             data.forEach(obj =>{
    //                 let row = frm.add_child("custom_item_charges_template")
    //                 row.type = obj.type;
    //                 row.account_head = obj.account_head;
    //                 row.amount = obj.amount;
    //                 row.description = obj.description;
    //                 row.reference_row = obj.reference_row;
    //             })
    //             frm.refresh_field("custom_item_charges_template")
    //         }
    //     })
    // }
})