begin;
set local search_path = public, extensions;
select plan(3);

insert into public.players (id, atp_id, first_name, last_name)
    overriding system value
values (900001, 'TEST011', 'Alpha', 'Tester'),
       (900002, 'TEST012', 'Beta',  'Tester'),
       (900003, 'TEST013', 'Gamma', 'Tester');

insert into public.matches (id, source_match_id, tournament, match_date, surface, round, winner_id, loser_id, score)
    overriding system value
values (900001, 'TESTM1', 'Test Open', '2024-01-10', 'Hard',  'F',   900001, 900002, '6-4 6-4'),
       (900002, 'TESTM2', 'Test Open', '2024-06-10', 'Clay',  'SF',  900002, 900001, '7-6 6-3'),
       (900003, 'TESTM3', 'Test Open', '2024-07-01', 'Grass', 'R16', 900001, 900003, '6-0 6-0');

select is(
    (select count(*)::int from public.get_head_to_head(900001, 900002)),
    2,
    'returns both matches between the two players'
    );

select is(
    (select count(*)::int from public.get_head_to_head(900002, 900001)),
    2,
    'result is the same with the players swapped'
    );

select is(
    (select count(*)::int from public.get_head_to_head(900002, 900003)),
    0,
    'returns nothing for players who never met'
    );

select * from finish();
rollback;