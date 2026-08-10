ALTER TABLE {{schema}}.entity_memory_operations
  DROP CONSTRAINT entity_memory_operations_source_entity_id_fkey,
  DROP CONSTRAINT entity_memory_operations_target_entity_id_fkey;

ALTER TABLE {{schema}}.entity_memory_operations
  ADD CONSTRAINT entity_memory_operations_source_entity_id_fkey
    FOREIGN KEY (source_entity_id) REFERENCES {{schema}}.user_entities(id) ON DELETE CASCADE,
  ADD CONSTRAINT entity_memory_operations_target_entity_id_fkey
    FOREIGN KEY (target_entity_id) REFERENCES {{schema}}.user_entities(id) ON DELETE CASCADE;
