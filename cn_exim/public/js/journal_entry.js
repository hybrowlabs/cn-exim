frappe.ui.form.on('Journal Entry', {
	refresh: function(frm) {
        frm.set_df_property('voucher_type', 'options', ['Journal Entry',
            'Inter Company Journal Entry',
           ' Bank Entry',
          '  Cash Entry',
          '  Credit Card Entry',
            'Debit Note',
            'Credit Note',
            'Contra Entry',
            'Excise Entry',
            'Write Off Entry',
           ' Opening Entry',
            'Depreciation Entry',
            'Exchange Rate Revaluation',
            'Exchange Gain Or Loss',
            'Deferred Revenue',
            'Deferred Expense',
            'EMD Entry',])
            
    }
})

frappe.ui.form.on("Journal Entry", {
  onload:function(frm){
      frm.ignore_doctypes_on_cancel_all = ["EMD"];
  }
});