import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { generateLeadsCsv, csvCell, LeadsExportLimitError } from '../lib/admin/leads-export.ts';
const row = { recordType:'Lead',name:'José, "Peña"\nCliente',members:'José',personCount:1,primaryContact:'José',email:'cliente@example.test',phone:'+1 (787) 555-0100',status:'Nuevo',sources:'Registro prioritario',property:'Casa',context:'Ponce',created:'16/9/2026',lastActivity:'16/9/2026',nextFollowUp:'' };
test('CSV BOM, accents, quoting, newlines, empty and phone text',()=>{
 const csv=generateLeadsCsv([row]); assert.ok(csv.startsWith('\uFEFF')); assert.match(csv,/José, ""Peña""\nCliente/); assert.match(csv,/"'\+1 \(787\) 555-0100"/); assert.ok(csv.endsWith('\r\n')); assert.equal(generateLeadsCsv([]).split('\r\n').length,2);
});
test('all dangerous prefixes and whitespace bypasses are neutralized',()=>{
 for(const value of ['=1+1','+1','-1','@SUM(1)','\t=1','\r\n+1','  -1']) assert.ok(csvCell(value).startsWith('"\''));
 assert.equal(csvCell('Ponce'),'"Ponce"'); assert.equal(csvCell('16/9/2026'),'"16/9/2026"');
});
test('explicit DTO prevents unknown private properties from serialization',()=>{
 const csv=generateLeadsCsv([{...row,notes:'PRIVATE-NOTES',objectKey:'PRIVATE-R2',auth:'PRIVATE-AUTH',id:'PRIVATE-ID',documents:'PRIVATE-DOC'}]);
 assert.doesNotMatch(csv,/PRIVATE-/); assert.equal(csv.split('\r\n')[0].split(',').length,14);
});
test('5000 allowed, 5001 and oversized output rejected',()=>{
 assert.ok(generateLeadsCsv(Array(5000).fill(row))); assert.throws(()=>generateLeadsCsv(Array(5001).fill(row)),LeadsExportLimitError);
 assert.throws(()=>generateLeadsCsv([{...row,name:'x'.repeat(11*1024*1024)}]),LeadsExportLimitError);
});
test('set-based query reuses canonical replacement and filter semantics without pagination loops',async()=>{
 const source=await readFile(new URL('../lib/admin/queries/leads-export.ts',import.meta.url),'utf8');
 const directory=await readFile(new URL('../lib/admin/queries/unified-lead-directory.ts',import.meta.url),'utf8');
 assert.match(source,/buildUnifiedLeadDirectoryQuery/); assert.match(source,/showIndividuals: false, page: 1/); assert.match(source,/LEADS_EXPORT_ROW_LIMIT \+ 1/);
 assert.match(source,/gm\.is_primary_contact/); assert.match(source,/gm\.removed_at IS NULL AND l\.merged_into_lead_id IS NULL/);
 assert.equal((source.match(/sql\.unsafe/g)||[]).length,1); assert.doesNotMatch(source,/getLead360|UPDATE |INSERT |DELETE |setInterval/);
 assert.match(directory,/g\.archived_at IS NULL/); assert.match(directory,/OR NOT EXISTS/); assert.match(directory,/gm\.removed_at IS NULL/);
 for(const field of ['search','status','source','propertyId','range','sort']) assert.match(directory,new RegExp(`filters\\.${field}`));
});
test('route authorizes first and provides controlled errors and private headers',async()=>{
 const source=await readFile(new URL('../app/api/admin/leads/export/route.ts',import.meta.url),'utf8');
 assert.ok(source.indexOf('await requireModuleAccess("leads", "view")')<source.indexOf('await getOperationalExportRows'));
 for(const value of ['401','403','400','413','500','private, no-store','noindex','nosniff','text/csv; charset=utf-8','attachment']) assert.ok(source.includes(value));
 assert.doesNotMatch(source,/console\.|writeFile|putObject/);
});
test('dialog uses native modal keyboard behavior, warnings and filtered download',async()=>{
 const source=await readFile(new URL('../components/admin/LeadsExportControl.tsx',import.meta.url),'utf8');
 assert.match(source,/<dialog/); assert.match(source,/showModal/); assert.match(source,/aria-labelledby/); assert.match(source,/trigger.current\?\.focus/); assert.match(source,/no sólo esta página/); assert.match(source,/información de clientes/); assert.match(source,/URL.revokeObjectURL/);
});
