frappe.listview_settings['Item'] = {
    onload(listview) {
        listview.page.add_action_item(__('Add Putaway Rules'), () => {
            const selected = listview.get_checked_items().map(r => r.name);
            const confirm_msg = __('This will create Putaway Rules for items without an existing rule, based on their Material Type. Proceed?');
            frappe.confirm(confirm_msg, () => {
                frappe.call({
                    method: 'cn_exim.config.py.item.bulk_create_putaway_rules_from_material_types',
                    args: { item_names: selected },
                    freeze: true,
                    freeze_message: __('Creating Putaway Rules...'),
                    callback: function(r) {
                        if (!r.message) return;
                        const msg = r.message;
                        let lines = [];
                        if (msg.created && msg.created.length) lines.push(__('Created: {0}', [msg.created.length]));
                        if (msg.skipped && msg.skipped.length) lines.push(__('Skipped (exists/missing config): {0}', [msg.skipped.length]));
                        if (msg.errors && msg.errors.length) lines.push(__('Errors: {0}', [msg.errors.length]));
                        frappe.msgprint(lines.join('<br/>'));
                        listview.refresh();
                    }
                });
            });
        });
    }
}


