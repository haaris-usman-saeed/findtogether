import {z} from 'zod';
const text=z.string().trim().max(1000), name=text.min(1), optional=text.nullish().transform(v=>v??undefined);
const age=z.discriminatedUnion('kind',[z.object({kind:z.literal('exact'),years:z.number().int().min(0).max(120)}),z.object({kind:z.literal('approximate'),band:z.enum(['under5','5to12','13to17','18to29','30to44','45to64','65to79','80plus'])}),z.object({kind:z.literal('unknown')})]);
const contact=z.object({channel:z.enum(['shelter_desk','phone','email','caseworker']),detail:optional}).refine(v=>v.channel==='shelter_desk'||!!v.detail,{message:'Contact detail is required.'});
export const consent=z.object({matching:z.enum(['unknown','granted','declined']),contact:z.enum(['unknown','granted','declined'])});
export const registration=z.object({names:z.object({preferred:optional,full:optional,others:z.array(text).max(20)}),age,shelterId:name,lastKnownArea:optional,recognizableDetails:optional,familyNotes:optional,contact,consent,safetyConcern:z.boolean(),accompanyingAdult:optional});
export const search=z.object({requester:z.object({name,shelterId:name,contact,registrationReference:optional}),sought:z.object({name,otherNames:z.array(text).max(20),age,relationship:z.enum(['spouse_partner','parent','child','sibling','grandparent','grandchild','other_family','friend']),lastKnown:optional,details:optional})});
const ref=z.object({registrationReference:name});
export const decision=z.discriminatedUnion('type',[
ref.extend({type:z.literal('begin_verification')}),ref.extend({type:z.literal('stop_verification')}),ref.extend({type:z.literal('record_contact_made')}),ref.extend({type:z.literal('rule_out'),reason:name}),z.object({type:z.literal('clear_review_flag')}),z.object({type:z.literal('flag_for_review'),reasons:z.array(z.enum(['distinguishing_detail','possible_duplicate','conflicting_details','senior_review'])).min(1).max(4),note:name})]);
const evidence={method:z.enum(['in_person','phone','caseworker']),note:optional};
export const verification=z.discriminatedUnion('step',[z.object({...evidence,step:z.literal('relationship'),result:z.enum(['confirmed','not_confirmed','unreachable'])}),z.object({...evidence,step:z.literal('registered_consent'),result:z.enum(['agrees','declines','unreachable'])}),z.object({...evidence,step:z.literal('requester_consent'),result:z.enum(['agrees','declines','unreachable'])})]);
export const coordination=z.object({method:z.enum(['supervised_call','relayed_message','staffed_meeting'])});
