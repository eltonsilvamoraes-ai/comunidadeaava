-- =====================================================================
-- PROJETO ESCALA — TESTE do papel LÍDER
-- Transforma o login@teste.com em LÍDER de um departamento, para você
-- entrar no PAINEL (index.html) com ele e ver só a equipe dele.
--
-- Troque o e-mail e o nome do departamento abaixo se quiser.
-- =====================================================================

-- 1) vira líder ativo
update public.usuarios
   set papel = 'lider', ativo = true
 where email = 'login@teste.com';

-- 2) atribui um departamento a esse líder (troque 'Transmissão' se quiser)
insert into public.usuario_departamento (igreja_id, usuario_id, departamento_id)
select u.igreja_id, u.id, d.id
  from public.usuarios u
  join public.departamentos d on d.igreja_id = u.igreja_id and d.nome = 'Transmissão'
 where u.email = 'login@teste.com'
on conflict do nothing;

-- 3) confere
select u.email, u.papel, u.ativo, d.nome as departamento_gerenciado
  from public.usuarios u
  left join public.usuario_departamento ud on ud.usuario_id = u.id
  left join public.departamentos d on d.id = ud.departamento_id
 where u.email = 'login@teste.com';

-- =====================================================================
-- Depois: entre no PAINEL (index.html) com login@teste.com.
-- Esperado: em Voluntários, Montar escala e Dashboard você vê SÓ o
-- departamento Transmissão (a equipe desse líder). O Admin continua vendo tudo.
--
-- Para DESFAZER o teste (voltar a ser voluntário), rode:
--   delete from public.usuario_departamento ud using public.usuarios u
--     where ud.usuario_id = u.id and u.email = 'login@teste.com';
--   update public.usuarios set papel='voluntario' where email='login@teste.com';
-- =====================================================================
