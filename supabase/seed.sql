-- Lexify School curriculum/configuration seed, separate from schema migration.
-- Curriculum entries are provisional and require KICD/KNEC verification before public reliance.
-- Stable natural codes are used; no generated UUIDs are embedded. Re-running is safe.

insert into public.education_systems(code,name,is_active,starts_on,ends_on,notes) values
 ('JUNIOR_CBE','Junior School (CBE)',true,null,null,'Rationalised nine-learning-area structure; verify merged-area assumptions against official KICD documents.'),
 ('SENIOR_CBE','Senior School (CBE)',true,'2026-01-01',null,'Grade 10 cohort started January 2026. Curriculum details are provisional pending KICD/KNEC verification.'),
 ('844','8-4-4 Secondary',true,null,'2027-12-31','Form 3 is the final cohort, with final KCSE in 2027; Form 4 sits KCSE in 2026.')
on conflict(code) do nothing;

insert into public.grades(system_id,code,name,level_order,is_active,starts_on,ends_on,cohort_label)
select e.id,x.code,x.name,x.ord,x.active,x.starts,x.ends,x.label
from (values
 ('JUNIOR_CBE','G7','Grade 7',7,true,null::date,null::date,null::text),
 ('JUNIOR_CBE','G8','Grade 8',8,true,null::date,null::date,null::text),
 ('JUNIOR_CBE','G9','Grade 9',9,true,null::date,null::date,null::text),
 ('SENIOR_CBE','G10','Grade 10',10,true,'2026-01-01'::date,null::date,'First Senior School cohort'),
 ('SENIOR_CBE','G11','Grade 11',11,false,'2027-01-01'::date,null::date,'Scheduled to start January 2027'),
 ('SENIOR_CBE','G12','Grade 12',12,false,'2028-01-01'::date,null::date,'Later cohort; activation date to be confirmed'),
 ('844','F1','Form 1',1,false,null::date,null::date,'Inactive legacy level'),
 ('844','F2','Form 2',2,false,null::date,null::date,'Inactive legacy level'),
 ('844','F3','Form 3',3,true,null::date,'2027-12-31'::date,'Final 8-4-4 cohort; final KCSE 2027'),
 ('844','F4','Form 4',4,true,null::date,'2026-12-31'::date,'2026 KCSE cohort')
) as x(system_code,code,name,ord,active,starts,ends,label)
join public.education_systems e on e.code=x.system_code
on conflict(code) do nothing;

insert into public.pathways(system_id,code,name,description,sort_order)
select e.id,x.code,x.name,x.description,x.ord from (values
 ('SENIOR_CBE','STEM','STEM','Science, Technology, Engineering and Mathematics pathway',1),
 ('SENIOR_CBE','SOCIAL_SCIENCES','Social Sciences','Languages and Literature; Humanities and Business Studies',2),
 ('SENIOR_CBE','ARTS_SPORTS','Arts and Sports Science','Performing Arts; Visual Arts; Sports Science',3)
) x(system_code,code,name,description,ord) join public.education_systems e on e.code=x.system_code
on conflict(code) do nothing;

insert into public.pathway_tracks(pathway_id,code,name,sort_order)
select p.id,x.code,x.name,x.ord from (values
 ('STEM','STEM_PURE_SCIENCES','Pure Sciences',1),('STEM','STEM_APPLIED_SCIENCES','Applied Sciences',2),('STEM','STEM_TECHNICAL_STUDIES','Technical Studies',3),
 ('SOCIAL_SCIENCES','SOCIAL_LANGUAGES_LITERATURE','Languages and Literature',1),('SOCIAL_SCIENCES','SOCIAL_HUMANITIES_BUSINESS','Humanities and Business Studies',2),
 ('ARTS_SPORTS','ARTS_PERFORMING','Performing Arts',1),('ARTS_SPORTS','ARTS_VISUAL','Visual Arts',2),('ARTS_SPORTS','ARTS_SPORTS_SCIENCE','Sports Science',3)
) x(pathway_code,code,name,ord) join public.pathways p on p.code=x.pathway_code
on conflict(code) do nothing;

insert into public.subject_groups(system_id,code,name,description,is_compulsory)
select e.id,x.code,x.name,x.description,x.compulsory from (values
 ('844','I','Group I — compulsory','All Group I subjects are compulsory.',true),
 ('844','II','Group II — sciences','Choose at least two science subjects.',false),
 ('844','III','Group III — humanities','Choose at least one humanities subject.',false),
 ('844','IV','Group IV — technical and applied','Technical and applied subjects.',false),
 ('844','V','Group V — languages and others','Languages and other subjects.',false)
) x(system_code,code,name,description,compulsory) join public.education_systems e on e.code=x.system_code
on conflict(system_id,code) do nothing;

-- Junior School parent areas and named alternatives/sub-areas.
insert into public.learning_areas(code,system_id,title,description,is_core,is_examinable,is_active,icon_name,accent_color,sort_order)
select x.code,e.id,x.title,x.description,true,true,true,x.icon,x.color,x.ord
from (values
 ('JUN_ENGLISH','English','Compulsory junior learning area','BookOpen','#2563EB',1),
 ('JUN_KISWAHILI','Kiswahili / Kenya Sign Language','Kiswahili; Kenya Sign Language is an alternative only for learners who are deaf.','Languages','#16A34A',2),
 ('JUN_MATHEMATICS','Mathematics','Compulsory junior learning area','Calculator','#2563EB',3),
 ('JUN_INTEGRATED_SCIENCE','Integrated Science','Includes Health Education.','FlaskConical','#16A34A',4),
 ('JUN_SOCIAL_STUDIES','Social Studies','Includes Life Skills.','Users','#0D9488',5),
 ('JUN_RELIGIOUS_EDUCATION','Religious Education','Choose exactly one of CRE, IRE or HRE.','Church','#2563EB',6),
 ('JUN_AGRICULTURE','Agriculture','Includes Home Science / Nutrition.','Sprout','#84CC16',7),
 ('JUN_PRETECH','Pre-Technical Studies','Includes Business Studies and Computer Studies.','Wrench','#64748B',8),
 ('JUN_CREATIVE_ARTS_SPORTS','Creative Arts and Sports','Visual Arts, Performing Arts, Sports and Physical Education.','Palette','#EC4899',9)
) x(code,title,description,icon,color,ord) join public.education_systems e on e.code='JUNIOR_CBE'
on conflict(code) do nothing;

insert into public.learning_areas(code,system_id,parent_area_id,title,description,is_core,is_examinable,is_active,icon_name,accent_color,restriction_code,sort_order)
select x.code,e.id,p.id,x.title,x.description,false,true,true,x.icon,x.color,x.restriction,x.ord
from (values
 ('JUN_KENYA_SIGN_LANGUAGE','JUN_KISWAHILI','Kenya Sign Language','Alternative to Kiswahili only for learners who are deaf.','Hand','#7C3AED','DEAF_LEARNER_ONLY',1),
 ('JUN_CRE','JUN_RELIGIOUS_EDUCATION','Christian Religious Education','One religious education choice.','Church','#2563EB',null,2),
 ('JUN_IRE','JUN_RELIGIOUS_EDUCATION','Islamic Religious Education','One religious education choice.','MoonStar','#16A34A',null,3),
 ('JUN_HRE','JUN_RELIGIOUS_EDUCATION','Hindu Religious Education','One religious education choice.','Flower2','#F97316',null,4),
 ('JUN_HEALTH_EDUCATION','JUN_INTEGRATED_SCIENCE','Health Education','Earlier separate area, nested under rationalised Integrated Science.','HeartPulse','#16A34A',null,5),
 ('JUN_LIFE_SKILLS','JUN_SOCIAL_STUDIES','Life Skills','Earlier separate area, nested under rationalised Social Studies.','Lightbulb','#EAB308',null,6),
 ('JUN_HOME_SCIENCE','JUN_AGRICULTURE','Home Science / Nutrition','Earlier separate area, nested under rationalised Agriculture.','ChefHat','#F97316',null,7),
 ('JUN_BUSINESS_STUDIES','JUN_PRETECH','Business Studies','Earlier separate area, nested under rationalised Pre-Technical Studies.','Briefcase','#F59E0B',null,8),
 ('JUN_COMPUTER_STUDIES','JUN_PRETECH','Computer Studies','Earlier separate area, nested under rationalised Pre-Technical Studies; also optional tutoring area.','Laptop','#06B6D4',null,9),
 ('JUN_VISUAL_ARTS','JUN_CREATIVE_ARTS_SPORTS','Visual Arts','Earlier separate area, nested under rationalised Creative Arts and Sports.','Palette','#EC4899',null,10),
 ('JUN_PERFORMING_ARTS','JUN_CREATIVE_ARTS_SPORTS','Performing Arts','Earlier separate area, nested under rationalised Creative Arts and Sports.','Music','#8B5CF6',null,11),
 ('JUN_SPORTS_PE','JUN_CREATIVE_ARTS_SPORTS','Sports and Physical Education','Included within rationalised Creative Arts and Sports.','Trophy','#F97316',null,12),
 ('JUN_FRENCH',null,'French','Optional tutoring-only area, not part of the nine learning areas.','Globe2','#EF4444','TUTORING_ONLY',20),
 ('JUN_GERMAN',null,'German','Optional tutoring-only area, not part of the nine learning areas.','Globe2','#3B82F6','TUTORING_ONLY',21),
 ('JUN_MANDARIN',null,'Mandarin Chinese','Optional tutoring-only area, not part of the nine learning areas.','Globe2','#F59E0B','TUTORING_ONLY',22),
 ('JUN_ARABIC',null,'Arabic','Optional tutoring-only area, not part of the nine learning areas.','Globe2','#DC2626','TUTORING_ONLY',23),
 ('JUN_INDIGENOUS_LANGUAGE',null,'Indigenous Language','Optional tutoring-only area, not part of the nine learning areas.','MessageCircle','#F97316','TUTORING_ONLY',24)
) x(code,parent_code,title,description,icon,color,restriction,ord)
join public.education_systems e on e.code='JUNIOR_CBE'
left join public.learning_areas p on p.code=x.parent_code
on conflict(code) do nothing;

-- Senior School core alternatives, tracks and electives. PE remains unconfirmed/optional.
insert into public.learning_areas(code,system_id,pathway_id,track_id,title,description,is_core,is_examinable,is_active,icon_name,accent_color,is_optional_activity,restriction_code,sort_order)
select x.code,e.id,p.id,t.id,x.title,x.description,x.core,x.examinable,true,x.icon,x.color,x.optional,x.restriction,x.ord
from (values
 ('SEN_ENGLISH',null::text,null::text,'English','Core learning area',true,true,'BookOpen','#2563EB',false,null::text,1),
 ('SEN_KISWAHILI',null::text,null::text,'Kiswahili','Core; Kenya Sign Language is an alternative for deaf learners.',true,true,'Languages','#16A34A',false,null::text,2),
 ('SEN_KSL',null::text,null::text,'Kenya Sign Language','Core-language alternative only for learners who are deaf.',true,true,'Hand','#7C3AED',false,'DEAF_LEARNER_ONLY',3),
 ('SEN_CSL',null::text,null::text,'Community Service Learning','Core learning area.',true,true,'HeartHandshake','#EF4444',false,null::text,4),
 ('SEN_CORE_MATH','STEM','STEM_PURE_SCIENCES','Core Mathematics','Core mathematics for STEM; required for Pure Sciences track.',true,true,'Calculator','#2563EB',false,'PURE_SCIENCES_REQUIRED',5),
 ('SEN_ESSENTIAL_MATH',null::text,null::text,'Essential Mathematics','Core mathematics for pathways other than STEM.',true,true,'Calculator','#2563EB',false,'NON_STEM_CORE',6),
 ('SEN_PHYSICAL_EDUCATION','ARTS_SPORTS','ARTS_SPORTS_SCIENCE','Physical Education','Optional activity until KICD confirms its status; not treated as a core subject.',false,false,'Dumbbell','#F97316',true,'STATUS_UNCONFIRMED',90),
 ('SEN_ADVANCED_MATH','STEM','STEM_PURE_SCIENCES','Advanced Mathematics','STEM — Pure Sciences.',false,true,'Sigma','#2563EB',false,null,10),
 ('SEN_BIOLOGY','STEM','STEM_PURE_SCIENCES','Biology','STEM — Pure Sciences.',false,true,'Dna','#16A34A',false,null,11),
 ('SEN_CHEMISTRY','STEM','STEM_PURE_SCIENCES','Chemistry','STEM — Pure Sciences.',false,true,'TestTubes','#7C3AED',false,null,12),
 ('SEN_PHYSICS','STEM','STEM_PURE_SCIENCES','Physics','STEM — Pure Sciences.',false,true,'Atom','#2563EB',false,null,13),
 ('SEN_GENERAL_SCIENCE','STEM','STEM_PURE_SCIENCES','General Science','Combination overlap restrictions apply with Biology, Chemistry and Physics.',false,true,'FlaskConical','#16A34A',false,null,14),
 ('SEN_AGRICULTURE','STEM','STEM_APPLIED_SCIENCES','Agriculture','STEM — Applied Sciences.',false,true,'Sprout','#84CC16',false,null,15),
 ('SEN_COMPUTER_STUDIES','STEM','STEM_APPLIED_SCIENCES','Computer Studies','STEM — Applied Sciences.',false,true,'Laptop','#06B6D4',false,null,16),
 ('SEN_HOME_SCIENCE','STEM','STEM_APPLIED_SCIENCES','Home Science','STEM — Applied Sciences.',false,true,'ChefHat','#F97316',false,null,17),
 ('SEN_DRAWING_DESIGN','STEM','STEM_TECHNICAL_STUDIES','Drawing and Design','STEM — Technical Studies.',false,true,'PencilRuler','#64748B',false,null,18),
 ('SEN_AVIATION','STEM','STEM_TECHNICAL_STUDIES','Aviation Technology','STEM — Technical Studies.',false,true,'Plane','#38BDF8',false,null,19),
 ('SEN_BUILDING','STEM','STEM_TECHNICAL_STUDIES','Building and Construction','STEM — Technical Studies.',false,true,'HardHat','#F59E0B',false,null,20),
 ('SEN_ELECTRICAL','STEM','STEM_TECHNICAL_STUDIES','Electrical Technology','STEM — Technical Studies.',false,true,'Zap','#EAB308',false,null,21),
 ('SEN_METAL','STEM','STEM_TECHNICAL_STUDIES','Metal Technology','STEM — Technical Studies.',false,true,'Hammer','#6B7280',false,null,22),
 ('SEN_POWER_MECHANICS','STEM','STEM_TECHNICAL_STUDIES','Power Mechanics','STEM — Technical Studies.',false,true,'Cog','#6B7280',false,null,23),
 ('SEN_WOOD','STEM','STEM_TECHNICAL_STUDIES','Wood Technology','STEM — Technical Studies.',false,true,'Axe','#92400E',false,null,24),
 ('SEN_MEDIA_TECH','STEM','STEM_TECHNICAL_STUDIES','Media Technology','STEM — Technical Studies.',false,true,'Video','#DC2626',false,null,25),
 ('SEN_MARINE','STEM','STEM_TECHNICAL_STUDIES','Marine and Fisheries Technology','STEM — Technical Studies.',false,true,'Fish','#2563EB',false,null,26),
 ('SEN_ADV_ENGLISH','SOCIAL_SCIENCES','SOCIAL_LANGUAGES_LITERATURE','Advanced English','Social Sciences — Languages and Literature.',false,true,'BookOpen','#2563EB',false,null,30),
 ('SEN_LITERATURE','SOCIAL_SCIENCES','SOCIAL_LANGUAGES_LITERATURE','Literature in English','Social Sciences — Languages and Literature.',false,true,'BookText','#4F46E5',false,null,31),
 ('SEN_INDIGENOUS_LANG','SOCIAL_SCIENCES','SOCIAL_LANGUAGES_LITERATURE','Indigenous Language','Social Sciences — Languages and Literature.',false,true,'MessageCircle','#F97316',false,null,32),
 ('SEN_KISWAHILI_KIPEVU','SOCIAL_SCIENCES','SOCIAL_LANGUAGES_LITERATURE','Kiswahili Kipevu','Social Sciences — Languages and Literature.',false,true,'Languages','#16A34A',false,null,33),
 ('SEN_FASIHI','SOCIAL_SCIENCES','SOCIAL_LANGUAGES_LITERATURE','Fasihi ya Kiswahili','Social Sciences — Languages and Literature.',false,true,'ScrollText','#0D9488',false,null,34),
 ('SEN_SIGN_LANGUAGE','SOCIAL_SCIENCES','SOCIAL_LANGUAGES_LITERATURE','Sign Language','Available only to deaf learners.',false,true,'Hand','#7C3AED',false,'DEAF_LEARNER_ONLY',35),
 ('SEN_ARABIC','SOCIAL_SCIENCES','SOCIAL_LANGUAGES_LITERATURE','Arabic','Social Sciences — Languages and Literature.',false,true,'Globe2','#DC2626',false,null,36),
 ('SEN_FRENCH','SOCIAL_SCIENCES','SOCIAL_LANGUAGES_LITERATURE','French','Social Sciences — Languages and Literature.',false,true,'Globe2','#EF4444',false,null,37),
 ('SEN_GERMAN','SOCIAL_SCIENCES','SOCIAL_LANGUAGES_LITERATURE','German','Social Sciences — Languages and Literature.',false,true,'Globe2','#3B82F6',false,null,38),
 ('SEN_MANDARIN','SOCIAL_SCIENCES','SOCIAL_LANGUAGES_LITERATURE','Mandarin Chinese','Social Sciences — Languages and Literature.',false,true,'Globe2','#F59E0B',false,null,39),
 ('SEN_HISTORY_CITIZENSHIP','SOCIAL_SCIENCES','SOCIAL_HUMANITIES_BUSINESS','History and Citizenship','Social Sciences — Humanities and Business Studies.',false,true,'Landmark','#92400E',false,null,40),
 ('SEN_GEOGRAPHY','SOCIAL_SCIENCES','SOCIAL_HUMANITIES_BUSINESS','Geography','Social Sciences — Humanities and Business Studies.',false,true,'Map','#16A34A',false,null,41),
 ('SEN_CRE','SOCIAL_SCIENCES','SOCIAL_HUMANITIES_BUSINESS','Christian Religious Education','Only one Religious Education choice across the selected combination.',false,true,'Church','#2563EB',false,'RELIGIOUS_EDUCATION',42),
 ('SEN_IRE','SOCIAL_SCIENCES','SOCIAL_HUMANITIES_BUSINESS','Islamic Religious Education','Only one Religious Education choice across the selected combination.',false,true,'MoonStar','#16A34A',false,'RELIGIOUS_EDUCATION',43),
 ('SEN_HRE','SOCIAL_SCIENCES','SOCIAL_HUMANITIES_BUSINESS','Hindu Religious Education','Only one Religious Education choice across the selected combination.',false,true,'Flower2','#F97316',false,'RELIGIOUS_EDUCATION',44),
 ('SEN_BUSINESS','SOCIAL_SCIENCES','SOCIAL_HUMANITIES_BUSINESS','Business Studies','Social Sciences — Humanities and Business Studies.',false,true,'Briefcase','#F59E0B',false,null,45),
 ('SEN_SPORTS_RECREATION','ARTS_SPORTS','ARTS_SPORTS_SCIENCE','Sports and Recreation','Arts and Sports Science — Sports Science.',false,true,'Trophy','#F97316',false,null,50),
 ('SEN_MUSIC_DANCE','ARTS_SPORTS','ARTS_PERFORMING','Music and Dance','Arts and Sports Science — Performing Arts.',false,true,'Music','#8B5CF6',false,null,51),
 ('SEN_THEATRE_FILM','ARTS_SPORTS','ARTS_PERFORMING','Theatre and Film','Arts and Sports Science — Performing Arts.',false,true,'Clapperboard','#DC2626',false,null,52),
 ('SEN_FINE_ARTS','ARTS_SPORTS','ARTS_VISUAL','Fine Arts','Arts and Sports Science — Visual Arts.',false,true,'Palette','#EC4899',false,null,53)
) x(code,path_code,track_code,title,description,core,examinable,icon,color,optional,restriction,ord)
join public.education_systems e on e.code='SENIOR_CBE'
left join public.pathways p on p.code=x.path_code
left join public.pathway_tracks t on t.code=x.track_code
on conflict(code) do nothing;

-- KCSE Group I-V subject records and only the codes supplied in the brief.
insert into public.learning_areas(code,system_id,group_id,title,description,kcse_code,is_core,is_examinable,is_active,icon_name,accent_color,sort_order)
select x.code,e.id,g.id,x.title,x.description,x.kcse_code,x.core,true,true,x.icon,x.color,x.ord
from (values
 ('KCSE_ENGLISH','I','English','Group I compulsory. The source brief gives English code as 101/102; verify exact current KNEC code.','101/102',true,'BookOpen','#2563EB',1),
 ('KCSE_KISWAHILI','I','Kiswahili','Group I compulsory.', '102',true,'Languages','#16A34A',2),
 ('KCSE_MATH_A','I','Mathematics (121)','Group I compulsory; candidate selects the applicable Mathematics code.','121',true,'Calculator','#2563EB',3),
 ('KCSE_MATH_B','I','Mathematics (122)','Group I compulsory alternative code; applicable selection to be confirmed.','122',true,'Calculator','#2563EB',4),
 ('KCSE_BIOLOGY','II','Biology','Group II sciences.',null,false,'Dna','#16A34A',10),
 ('KCSE_PHYSICS','II','Physics','Group II sciences.',null,false,'Atom','#2563EB',11),
 ('KCSE_CHEMISTRY','II','Chemistry','Group II sciences.',null,false,'TestTubes','#7C3AED',12),
 ('KCSE_HISTORY','III','History and Government','Group III humanities.',null,false,'Landmark','#92400E',20),
 ('KCSE_GEOGRAPHY','III','Geography','Group III humanities.',null,false,'Map','#16A34A',21),
 ('KCSE_CRE','III','Christian Religious Education','Group III; only one Religious Education subject.',null,false,'Church','#2563EB',22),
 ('KCSE_IRE','III','Islamic Religious Education','Group III; only one Religious Education subject.',null,false,'MoonStar','#16A34A',23),
 ('KCSE_HRE','III','Hindu Religious Education','Group III; only one Religious Education subject.',null,false,'Flower2','#F97316',24),
 ('KCSE_HOME_SCIENCE','IV','Home Science','Group IV technical and applied.',null,false,'ChefHat','#F97316',30),
 ('KCSE_ART_DESIGN','IV','Art and Design','Group IV technical and applied.',null,false,'Palette','#EC4899',31),
 ('KCSE_AGRICULTURE','IV','Agriculture','Group IV technical and applied.',null,false,'Sprout','#84CC16',32),
 ('KCSE_COMPUTER_STUDIES','IV','Computer Studies','Group IV technical and applied.','451',false,'Laptop','#06B6D4',33),
 ('KCSE_AVIATION','IV','Aviation','Group IV technical and applied.',null,false,'Plane','#38BDF8',34),
 ('KCSE_WOODWORK','IV','Woodwork','Group IV technical and applied.',null,false,'Axe','#92400E',35),
 ('KCSE_METALWORK','IV','Metalwork','Group IV technical and applied.',null,false,'Hammer','#6B7280',36),
 ('KCSE_BUILDING','IV','Building Construction','Group IV technical and applied.',null,false,'HardHat','#F59E0B',37),
 ('KCSE_POWER_MECHANICS','IV','Power Mechanics','Group IV technical and applied.',null,false,'Cog','#6B7280',38),
 ('KCSE_ELECTRICITY','IV','Electricity','Group IV technical and applied.',null,false,'Zap','#EAB308',39),
 ('KCSE_DRAWING_DESIGN','IV','Drawing and Design','Group IV technical and applied.',null,false,'PencilRuler','#64748B',40),
 ('KCSE_FRENCH','V','French','Group V languages and others.','501',false,'Globe2','#EF4444',50),
 ('KCSE_GERMAN','V','German','Group V languages and others.','502',false,'Globe2','#3B82F6',51),
 ('KCSE_ARABIC','V','Arabic','Group V languages and others.','503',false,'Globe2','#DC2626',52),
 ('KCSE_KSL','V','Kenya Sign Language','Group V languages and others.',null,false,'Hand','#7C3AED',53),
 ('KCSE_MUSIC','V','Music','Group V languages and others.','511',false,'Music','#8B5CF6',54),
 ('KCSE_BUSINESS','V','Business Studies','Group V languages and others.','565',false,'Briefcase','#F59E0B',55)
) x(code,group_code,title,description,kcse_code,core,icon,color,ord)
join public.education_systems e on e.code='844'
join public.subject_groups g on g.system_id=e.id and g.code=x.group_code
on conflict(code) do nothing;

-- Grade-to-area links: mandatory rationalised junior parents; alternatives and tutoring-only areas separately marked.
insert into public.grade_learning_areas(grade_id,learning_area_id,role,is_required,sort_order)
select g.id,a.id,case when a.restriction_code='TUTORING_ONLY' then 'optional' when a.parent_area_id is not null then 'sub_area' else 'core' end,
 (a.parent_area_id is null and a.restriction_code is null),a.sort_order
from public.grades g join public.learning_areas a on a.system_id=g.system_id
where g.code in ('G7','G8','G9') and a.code like 'JUN_%'
on conflict(grade_id,learning_area_id) do nothing;
-- Senior grades use one shared curriculum catalogue; 4 core subjects are determined by rule choice of KSL/math alternative.
insert into public.grade_learning_areas(grade_id,learning_area_id,role,is_required,sort_order)
select g.id,a.id,case when a.is_core then 'core' when a.is_optional_activity then 'optional' else 'elective' end,
 (a.is_core and a.code in ('SEN_ENGLISH','SEN_KISWAHILI','SEN_KSL','SEN_CSL','SEN_CORE_MATH','SEN_ESSENTIAL_MATH')),
 a.sort_order
from public.grades g join public.learning_areas a on a.system_id=g.system_id
where g.code in ('G10','G11','G12') and a.code like 'SEN_%'
on conflict(grade_id,learning_area_id) do nothing;
-- Every KCSE grade has catalog subjects; choice logic is represented in editable rules/settings.
insert into public.grade_learning_areas(grade_id,learning_area_id,role,is_required,sort_order)
select g.id,a.id,case when a.is_core then 'core' else 'elective' end,a.is_core,a.sort_order
from public.grades g join public.learning_areas a on a.system_id=g.system_id
where g.code in ('F3','F4') and a.code like 'KCSE_%'
on conflict(grade_id,learning_area_id) do nothing;

-- Editable, data-driven rules. UI/API/database must validate actual learner selections against these parameters.
insert into public.combination_rules(system_id,code,title,description,rule_json,is_enabled,is_warning_only,applies_from_grade_id)
select e.id,x.code,x.title,x.description,x.rule,
 true,x.warning,g.id
from (values
 ('JUNIOR_CBE','junior_rationalised_default','Junior rationalised curriculum default','Default display is the rationalised nine learning areas; expanded sub-areas may be enabled by an administrator.','{"setting":"junior_curriculum_mode","allowed":["rationalised","expanded"],"default":"rationalised","required_parent_areas":9}'::jsonb,false,'G7'),
 ('JUNIOR_CBE','junior_one_religion','Junior religious education choice','Choose exactly one of CRE, IRE or HRE.','{"exactly_one_of":["JUN_CRE","JUN_IRE","JUN_HRE"]}'::jsonb,false,'G7'),
 ('JUNIOR_CBE','junior_kiswahili_or_ksl','Kiswahili or Kenya Sign Language','Choose Kiswahili, or KSL only if the learner is deaf.','{"exactly_one_of":["JUN_KISWAHILI","JUN_KENYA_SIGN_LANGUAGE"],"restricted":{"JUN_KENYA_SIGN_LANGUAGE":"is_deaf_learner"}}'::jsonb,false,'G7'),
 ('JUNIOR_CBE','junior_optional_tutoring','Optional junior tutoring areas','Optional extra areas are tutoring-only and do not count among the nine learning areas.','{"codes":["JUN_FRENCH","JUN_GERMAN","JUN_MANDARIN","JUN_ARABIC","JUN_INDIGENOUS_LANGUAGE","JUN_COMPUTER_STUDIES","JUN_HOME_SCIENCE","JUN_BUSINESS_STUDIES","JUN_VISUAL_ARTS","JUN_PERFORMING_ARTS"],"not_in_compulsory_nine":true}'::jsonb,false,'G7'),
 ('SENIOR_CBE','senior_four_core_three_electives','Senior 4+3 subject count','Exactly four core subject choices (including one language alternative and one mathematics alternative) plus exactly three electives from one pathway.','{"core_count":4,"elective_count":3,"total":7,"exactly_one_pathway":true}'::jsonb,false,'G10'),
 ('SENIOR_CBE','senior_core_alternatives','Senior core subject alternatives','Select one language alternative and one mathematics alternative as part of the four core subjects.','{"exactly_one_from_each":[["SEN_KISWAHILI","SEN_KSL"],["SEN_CORE_MATH","SEN_ESSENTIAL_MATH"]]}'::jsonb,false,'G10'),
 ('SENIOR_CBE','senior_stem_default','STEM pathway default restriction','STEM learners select electives within STEM by default; admin may enable the limited mixed-pathway exception with school guidance.','{"pathway":"STEM","default_same_pathway_only":true,"allow_limited_exception":false,"exception":{"within_chosen_pathway":1,"other_pathways_max":2}}'::jsonb,false,'G10'),
 ('SENIOR_CBE','senior_no_overlap','No overlapping subject combinations','Prevent General Science with Biology, Chemistry or Physics. Approved combinations can be imported separately.','{"exclusions":[["SEN_GENERAL_SCIENCE","SEN_BIOLOGY"],["SEN_GENERAL_SCIENCE","SEN_CHEMISTRY"],["SEN_GENERAL_SCIENCE","SEN_PHYSICS"]]}'::jsonb,false,'G10'),
 ('SENIOR_CBE','senior_one_religion','One Religious Education subject','At most one of CRE, IRE or HRE can be selected.','{"at_most_one_of":["SEN_CRE","SEN_IRE","SEN_HRE"]}'::jsonb,false,'G10'),
 ('SENIOR_CBE','senior_ksl_deaf_only','KSL deaf-learner restriction','Kenya Sign Language is limited to learners who are deaf.','{"restricted":["SEN_KSL","SEN_SIGN_LANGUAGE"],"requires":"is_deaf_learner"}'::jsonb,false,'G10'),
 ('SENIOR_CBE','senior_math_by_track','Mathematics by pathway/track','Core Mathematics is required for STEM Pure Sciences; Essential Mathematics applies to other pathways.','{"pure_sciences_requires":"SEN_CORE_MATH","other_pathways_requires":"SEN_ESSENTIAL_MATH","mutually_exclusive":true}'::jsonb,false,'G10'),
 ('SENIOR_CBE','senior_approved_combinations_warning','Approved combination list warning','Use admin CSV import for approved combinations; nonlisted combinations warn but do not hard block.','{"lookup":"subject_combinations","unknown_combination":"warning_only"}'::jsonb,true,'G10'),
 ('SENIOR_CBE','senior_first_term_review','First term combination review','Allow learners to review their combination during the first term.','{"setting":"senior_combination_review_enabled","default":true,"window":"first_term"}'::jsonb,false,'G10'),
 ('SENIOR_CBE','senior_grade_inheritance','Grade 11/12 inheritance','Grades 11 and 12 inherit Grade 10 pathway and combination by default; admin may edit.','{"source_grade":"G10","target_grades":["G11","G12"],"default_inherit":true,"admin_editable":true}'::jsonb,false,'G11'),
 ('SENIOR_CBE','senior_pe_status','Physical Education status','Physical Education is optional/not confirmed, not a core subject unless administrator confirms.','{"learning_area":"SEN_PHYSICAL_EDUCATION","is_core":false,"is_examinable":false,"status":"unconfirmed"}'::jsonb,false,'G10'),
 ('844','kcse_subject_count','KCSE subject selection count','Candidate selects 7 to 9 subjects, all Group I, at least two Group II, one Group III, and one from remaining groups; one RE maximum.','{"min_subjects":7,"max_subjects":9,"group_min":{"I":3,"II":2,"III":1,"IV_or_V":1},"all_group_I":true,"max_religious_education":1}'::jsonb,false,'F3'),
 ('844','kcse_math_alternative','KCSE Mathematics alternative','Select the applicable Group I Mathematics subject code, 121 or 122.','{"exactly_one_of":["KCSE_MATH_A","KCSE_MATH_B"]}'::jsonb,false,'F3'),
 ('844','kcse_mean_grade','KCSE projected mean grade','Projected mean grade uses seven subjects: two compulsory subjects plus the best five others.','{"basis":"best_7","compulsory_count":2,"best_other_count":5,"label":"projected mean grade"}'::jsonb,false,'F3')
) x(system_code,code,title,description,rule,warning,grade_code)
join public.education_systems e on e.code=x.system_code
left join public.grades g on g.code=x.grade_code
on conflict(code) do nothing;

-- CBE default rating scales and supplied default bands (provisional; verify against official guidance).
insert into public.assessment_scales(system_id,code,title,label,is_default,is_active)
select e.id,x.code,x.title,'Lexify tutoring assessment',true,true
from (values ('JUNIOR_CBE','CBE_8','CBE 8-level rating scale'),('SENIOR_CBE','CBE_8','CBE 8-level rating scale'),('844','KCSE_12','KCSE 12-point scale')) x(system_code,code,title)
join public.education_systems e on e.code=x.system_code
on conflict(system_id,code) do nothing;
insert into public.scale_levels(scale_id,code,title,points,min_percent,max_percent,sort_order)
select s.id,x.code,x.title,x.points,x.min_pct,x.max_pct,x.ord
from (values
 ('CBE_8','EE1','Exceeding Expectation (high)',8,90,100,1),
 ('CBE_8','EE2','Exceeding Expectation',7,75,89,2),
 ('CBE_8','ME1','Meeting Expectation (high)',6,58,74,3),
 ('CBE_8','ME2','Meeting Expectation',5,41,57,4),
 ('CBE_8','AE1','Approaching Expectation (high)',4,31,40,5),
 ('CBE_8','AE2','Approaching Expectation',3,21,30,6),
 ('CBE_8','BE1','Below Expectation (high)',2,11,20,7),
 ('CBE_8','BE2','Below Expectation',1,1,10,8),
 ('KCSE_12','A','A',12,80,100,1),
 ('KCSE_12','A_MINUS','A-',11,75,79,2),
 ('KCSE_12','B_PLUS','B+',10,70,74,3),
 ('KCSE_12','B','B',9,65,69,4),
 ('KCSE_12','B_MINUS','B-',8,60,64,5),
 ('KCSE_12','C_PLUS','C+',7,55,59,6),
 ('KCSE_12','C','C',6,50,54,7),
 ('KCSE_12','C_MINUS','C-',5,45,49,8),
 ('KCSE_12','D_PLUS','D+',4,40,44,9),
 ('KCSE_12','D','D',3,35,39,10),
 ('KCSE_12','D_MINUS','D-',2,30,34,11),
 ('KCSE_12','E','E',1,0,29,12)
) x(scale_code,code,title,points,min_pct,max_pct,ord)
join public.assessment_scales s on s.code=x.scale_code
on conflict do nothing;

-- Optional CBE competency vocabulary from the brief.
insert into public.core_competencies(code,title) values
 ('COMMUNICATION_COLLABORATION','Communication and collaboration'),('CRITICAL_THINKING','Critical thinking and problem solving'),
 ('IMAGINATION_CREATIVITY','Imagination and creativity'),('CITIZENSHIP','Citizenship'),('DIGITAL_LITERACY','Digital literacy'),
 ('LEARNING_TO_LEARN','Learning to learn'),('SELF_EFFICACY','Self-efficacy')
on conflict(code) do nothing;

-- App settings: editable defaults; no assumed contacts or prices.
insert into public.settings(key,value,description,is_public) values
 ('junior_curriculum_mode','"rationalised"'::jsonb,'Display rationalised or expanded Junior School areas; default is rationalised.','true'),
 ('senior_lessons_per_week','40'::jsonb,'Informational Senior School timetable guidance: about 40 lessons per week.','true'),
 ('senior_lesson_minutes','40'::jsonb,'Informational Senior School timetable guidance: lessons are about 40 minutes.','true'),
 ('senior_combination_review_enabled','true'::jsonb,'Allow learners to review combinations during first term.','false'),
 ('senior_grade_inherit_combination','true'::jsonb,'Grade 11/12 default to inherited Grade 10 pathway and combination.','false'),
 ('kcse_projected_mean_subject_count','7'::jsonb,'Projected mean grade is calculated from 7 subjects (2 compulsory and best 5 others).','false'),
 ('curriculum_verification_required','true'::jsonb,'Curriculum seed assumptions require verification against official KICD/KNEC documentation.','true')
on conflict(key) do nothing;

-- Placeholder course catalogue records only: no invented prices, instructor claims, lessons, or published content.
insert into public.courses(code,title,description,icon_name,accent_color,status,is_free)
values
 ('COURSE_COMPUTER_FUNDAMENTALS','Computer Fundamentals','Draft placeholder. Admin to add verified description, learning outcomes, modules, lessons, resources and price.','FileText','#2563EB','draft',false),
 ('COURSE_TYPING_KEYBOARD','Typing / Keyboard Skills','Draft placeholder. Admin to add verified description, learning outcomes, modules, lessons, resources and price.','Keyboard','#06B6D4','draft',false),
 ('COURSE_WORD','Microsoft Word','Draft placeholder. Admin to add verified description, learning outcomes, modules, lessons, resources and price.','FileText','#2563EB','draft',false),
 ('COURSE_EXCEL','Microsoft Excel','Draft placeholder. Admin to add verified description, learning outcomes, modules, lessons, resources and price.','Sheet','#16A34A','draft',false),
 ('COURSE_POWERPOINT','Microsoft PowerPoint','Draft placeholder. Admin to add verified description, learning outcomes, modules, lessons, resources and price.','Presentation','#F97316','draft',false),
 ('COURSE_ACCESS','Microsoft Access','Draft placeholder. Admin to add verified description, learning outcomes, modules, lessons, resources and price.','Database','#DC2626','draft',false),
 ('COURSE_PUBLISHER','Microsoft Publisher','Draft placeholder. Admin to add verified description, learning outcomes, modules, lessons, resources and price.','Newspaper','#0D9488','draft',false),
 ('COURSE_INTERNET_EMAIL','Internet and Email','Draft placeholder. Admin to add verified description, learning outcomes, modules, lessons, resources and price.','Globe2','#3B82F6','draft',false)
on conflict(code) do nothing;
