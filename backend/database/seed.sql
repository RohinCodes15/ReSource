-- Sample records for local development and demos. All status changes and cut_amount
-- figures below are illustrative, not official City of Fremont budget actions.
insert into public.services
  (id, name, category, status, address, lat, lng, description, cut_amount, effective_date)
values
  ('10000000-0000-4000-8000-000000000001', 'Fremont Main Library', 'library', 'reduced', '2400 Stevenson Blvd, Fremont, CA 94538', 37.5508, -121.9780, 'Illustrative reduced evening hours scenario; confirm current Alameda County Library hours. Sample cut estimate only.', 85000, '2026-07-01'),
  ('10000000-0000-4000-8000-000000000002', 'Niles Branch Library', 'library', 'open', '150 I St, Fremont, CA 94536', 37.5785, -121.9721, 'Open in this sample dataset. Check Alameda County Library for current hours.', 0, null),
  ('10000000-0000-4000-8000-000000000003', 'Irvington Community Center', 'recreation', 'reduced', '41800 Blacow Rd, Fremont, CA 94538', 37.5233, -121.9633, 'Illustrative reduction in evening drop-in programming; not an official notice.', 120000, '2026-07-01'),
  ('10000000-0000-4000-8000-000000000004', 'Aqua Adventure Waterpark', 'recreation', 'open', '40500 Paseo Padre Pkwy, Fremont, CA 94538', 37.5514, -121.9703, 'Open in this sample dataset. Verify seasonal operations and hours with the City.', 0, null),
  ('10000000-0000-4000-8000-000000000005', 'Central Park Recreation Programs', 'recreation', 'reduced', '40000 Paseo Padre Pkwy, Fremont, CA 94538', 37.5485, -121.9700, 'Illustrative reduction in low-cost youth recreation sessions; not an official notice.', 65000, '2026-07-01'),
  ('10000000-0000-4000-8000-000000000006', 'Centerville Community Center', 'recreation', 'closed', '3355 Country Dr, Fremont, CA 94536', 37.5580, -122.0060, 'Temporary closure shown as a hypothetical example only; check current City facility status.', 175000, '2026-09-01'),
  ('10000000-0000-4000-8000-000000000007', 'Irvington Dave Clinic (BACH)', 'health', 'open', '40910 Fremont Blvd, Fremont, CA 94538', 37.5314, -121.9618, 'Community health resource; this listing does not indicate a City service cut.', 0, null),
  ('10000000-0000-4000-8000-000000000008', 'Fremont Family Resource Center', 'health', 'open', '39155 Liberty St, Suite A110, Fremont, CA 94538', 37.5496, -121.9768, 'Multi-agency family support hub; confirm which partner programs are currently available.', 0, null),
  ('10000000-0000-4000-8000-000000000009', 'AC Transit Fremont Service', 'transit', 'reduced', 'Fremont BART Station, 2000 BART Way, Fremont, CA 94536', 37.5575, -121.9764, 'Hypothetical frequency reduction example. Check AC Transit for actual route and schedule changes.', 95000, '2026-07-01'),
  ('10000000-0000-4000-8000-000000000010', 'Fremont Youth and Family Services', 'education', 'open', '39155 Liberty St, Fremont, CA 94538', 37.5496, -121.9768, 'Youth and family support information; sample listing, not a budget cut notice.', 0, null)
on conflict (id) do update set
  name = excluded.name, category = excluded.category, status = excluded.status,
  address = excluded.address, lat = excluded.lat, lng = excluded.lng,
  description = excluded.description, cut_amount = excluded.cut_amount,
  effective_date = excluded.effective_date;

insert into public.resources
  (id, name, category, address, phone, website, lat, lng, description, languages)
values
  ('20000000-0000-4000-8000-000000000001', 'Tri-City Volunteers Food Bank', 'Food', '37350 Joseph St, Fremont, CA 94536', '(510) 793-4583', 'https://tcvfoodbank.org/', 37.5585, -122.0002, 'Community food bank with walk-up, drive-through, and mobile pantry services. Confirm distribution hours before visiting.', array['English', 'Spanish']),
  ('20000000-0000-4000-8000-000000000002', 'Abode Services', 'Housing', '40849 Fremont Blvd, Fremont, CA 94538', '(510) 657-7409', 'https://abode.org/', 37.5346, -121.9579, 'Bay Area nonprofit providing housing and supportive services. Call to ask about eligibility and current availability.', array['English', 'Spanish']),
  ('20000000-0000-4000-8000-000000000003', 'Bay Area Community Health — Irvington Dave Clinic', 'Health', '40910 Fremont Blvd, Fremont, CA 94538', '(510) 770-8040', 'https://bach.health/alameda-county-locations', 37.5314, -121.9618, 'Community health center with medical, pediatric, behavioral health, dental, and vision services at area clinics. Ask about fees and appointments.', array['English', 'Spanish', 'Vietnamese']),
  ('20000000-0000-4000-8000-000000000004', 'League of Volunteers', 'Community support', 'PO Box 1170, Newark, CA 94560 (serves Fremont)', '(510) 793-5683', 'https://www.lov.org/contact-lov', 37.5485, -121.9886, 'Tri-City nonprofit supporting youth, seniors, and neighbors in need. Contact the organization about current programs.', array['English']),
  ('20000000-0000-4000-8000-000000000005', 'SAVE Community Education', 'Family safety', '3155 Kearney St, Suite 220, Fremont, CA 94538', '(510) 794-6055', 'https://communityed.save-dv.org/', 37.5575, -121.9825, 'Fremont-based community education and support organization. Its 24-hour hotline is available for domestic violence support.', array['English', 'Spanish']),
  ('20000000-0000-4000-8000-000000000006', 'Immigration Institute of the Bay Area — Fremont', 'Legal services', '39055 Hastings St, Suite 202, Fremont, CA 94538', '(510) 894-3639', 'https://iibayarea.org/offices/fremont/', 37.5480, -121.9850, 'Nonprofit immigration legal services and workshops for Alameda County. Consultations are by appointment; call to confirm language availability.', array['English', 'Spanish']),
  ('20000000-0000-4000-8000-000000000007', 'Fremont Family Resource Center', 'Family support', '39155 Liberty St, Suite A110, Fremont, CA 94538', '(510) 574-2021', 'https://www.fremont.gov/government/departments/human-services', 37.5496, -121.9768, 'Local hub housing City, County, and nonprofit agencies. Call to check which partner organizations offer walk-in assistance.', array['English', 'Spanish']),
  ('20000000-0000-4000-8000-000000000008', '211 Alameda County', 'Information and referral', 'Phone and online directory serving Fremont', '211', 'https://211alamedacounty.org/', 37.5485, -121.9886, 'Information and referral for local food, housing, health, and social services. Ask about language access when you call.', array['English', 'Spanish', 'Vietnamese', 'Chinese'])
on conflict (id) do update set
  name = excluded.name, category = excluded.category, address = excluded.address,
  phone = excluded.phone, website = excluded.website, lat = excluded.lat,
  lng = excluded.lng, description = excluded.description, languages = excluded.languages;

insert into public.posts (id, content, upvotes, created_at)
values
  ('30000000-0000-4000-8000-000000000001', 'Sample resident tip: Call the library before heading over; branch hours and available services can change by location.', 18, now() - interval '2 days'),
  ('30000000-0000-4000-8000-000000000002', 'Sample resident tip: Tri-City Volunteers posts food distribution details online. Check the schedule before making the trip.', 14, now() - interval '1 day'),
  ('30000000-0000-4000-8000-000000000003', 'Sample resident tip: If a City program changes, ask staff which nearby nonprofit or County program can help as an alternative.', 11, now() - interval '18 hours'),
  ('30000000-0000-4000-8000-000000000004', 'Sample resident tip: You can submit written public comment to the City Clerk before a Council meeting; check the official agenda for deadlines.', 9, now() - interval '8 hours'),
  ('30000000-0000-4000-8000-000000000005', 'Sample resident tip: Call 211 for referrals if you are not sure which local program fits your situation.', 7, now() - interval '3 hours')
on conflict (id) do update set content = excluded.content, upvotes = excluded.upvotes, created_at = excluded.created_at;

insert into public.alerts (id, title, body, service_id, created_at)
values
  ('40000000-0000-4000-8000-000000000001', 'Sample notice: Library hours scenario updated', 'Illustrative notice only. Confirm current Fremont and Alameda County Library schedules with the library.', '10000000-0000-4000-8000-000000000001', now() - interval '1 day'),
  ('40000000-0000-4000-8000-000000000002', 'Sample notice: Irvington recreation scenario', 'Illustrative budget scenario, not an official closure notice. Check with the City before visiting.', '10000000-0000-4000-8000-000000000003', now() - interval '2 days'),
  ('40000000-0000-4000-8000-000000000003', 'Sample notice: Centerville facility scenario', 'This demo shows a hypothetical temporary closure. Verify current facility operations on fremont.gov.', '10000000-0000-4000-8000-000000000006', now() - interval '4 days'),
  ('40000000-0000-4000-8000-000000000004', 'Transit schedules: check before travel', 'No specific route cut is asserted here. Check AC Transit for current routes, schedules, and service alerts.', '10000000-0000-4000-8000-000000000009', now() - interval '5 days'),
  ('40000000-0000-4000-8000-000000000005', 'Community resource directory refreshed', 'Resource listings are informational. Contact each organization to confirm eligibility, hours, and language access.', '10000000-0000-4000-8000-000000000008', now() - interval '7 days')
on conflict (id) do update set title = excluded.title, body = excluded.body,
  service_id = excluded.service_id, created_at = excluded.created_at;
