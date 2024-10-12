// Copyright (c) 2024, Prathamesh Jadhav and contributors
// For license information, please see license.txt

frappe.ui.form.on("Pre-Alert", {
	total_doc_val:function(frm) {
        var total_inr = frm.doc.exch_rate * frm.doc.total_doc_val
        frm.set_value("total_inr_val", total_inr)
	},
    freight_amt: function(frm) {
        let total_value = 0;
        let total_charge = frm.doc.freight_amt + frm.doc.ex_works 

        frm.doc.item_details.forEach(item => {
            total_value += item.total_inr_value; 
        });

        frm.doc.item_details.forEach(item => {
            let item_charge = (item.total_inr_value / total_value) * total_charge;
            frappe.model.set_value(item.doctype, item.name, 'freight_amount', item_charge);
        });

        frm.refresh_field('item_details');
    },
    insurance:function(frm){
        let insurance_value = (frm.doc.total_inr_val * frm.doc.insurance) / 100
        let total_value = 0;

        frm.doc.item_details.forEach(item => {
            total_value += item.total_inr_value; 
        });

        frm.doc.item_details.forEach(item => {
            let item_charge = (item.total_inr_value / total_value) * insurance_value;
            frappe.model.set_value(item.doctype, item.name, 'insurance_amount', item_charge);
        });
    }
});

frappe.ui.form.on("Pre-Alert Item Details", {
    hsn_code:function(frm, cdt, cdn){
        var row = locals[cdt][cdn]
        get_percentage_of_hsn_and_category_base(frm, row)
    },
    category:function(frm, cdt, cdn){
        var row = locals[cdt][cdn]
        get_percentage_of_hsn_and_category_base(frm, row)
    }
})

function get_percentage_of_hsn_and_category_base(frm, row){
    if(row.hsn_code != undefined && row.category != ''){
        frappe.call({
            method:"cn_exim.cn_exim.doctype.pre_alert.pre_alert.get_percentage_of_hsn_and_category_base",
            args:{                
                name:row.hsn_code,
                category:row.category
            },
            callback:function(response){
                var data = response.message
                data.forEach(function(obj){
                    row.bcd_ = obj['bcd']
                    var bcd_amount = (obj['bcd'] * row.total_inr_value) / 100
                    row.bcd_amount = bcd_amount
                    row.hcs_ = obj['hcs']
                    var hcs_amount = (obj['hcs'] * row.total_inr_value) / 100
                    row.hcs_amount = hcs_amount
                    row.swl_ = obj['swl']
                    var swl_amount = (obj['swl'] * row.total_inr_value) / 100
                    row.swl_amount = swl_amount
                    row.igst_ = obj['igst']
                    var igst_amount = (obj['igst'] * row.total_inr_value) / 100
                    row.igst_amount = igst_amount
                })
                frm.refresh_field("item_details")
            }
        })
    }
}



function total_amount_calculate(frm, data){
    
}