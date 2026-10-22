import { describe, expect, it } from 'vitest'
import {
  normalizeDocumentInfo,
  normalizeKnowledgeBaseStats,
} from '../services/rag'
import {
  backendDocumentsFixture,
  backendKnowledgeBaseStatsFixture,
} from './fixtures/ragFixtures'
import type { DocumentInfo, KnowledgeBaseStats } from '../types'

describe('RAG Client Contract & Normalizer Tests', () => {
  describe('normalizeDocumentInfo contract', () => {
    it('correctly maps realistic backend global document payload to DocumentInfo', () => {
      const globalDocRaw = backendDocumentsFixture[0]
      const doc: DocumentInfo = normalizeDocumentInfo(globalDocRaw)

      expect(doc.id).toBe('6601a2b3c4d5e6f7a8b9c0d1')
      expect(doc.user_id).toBeNull()
      expect(doc.title).toBe('Software Engineer Role Matrix & Competency Guide')
      expect(doc.category).toBe('Role Matrix')
      expect(doc.chunk_count).toBe(4)
      expect(doc.content_length).toBe(3200)
      expect(doc.scope).toBe('global')
      expect(doc.deletable).toBe(false)
      expect(typeof doc.created_at).toBe('string')
      expect(isNaN(Date.parse(doc.created_at))).toBe(false)
    })

    it('correctly maps realistic backend user document payload to DocumentInfo', () => {
      const userDocRaw = backendDocumentsFixture[1]
      const doc: DocumentInfo = normalizeDocumentInfo(userDocRaw)

      expect(doc.id).toBe('6601a2b3c4d5e6f7a8b9c0d2')
      expect(doc.user_id).toBe('6601a2b3c4d5e6f7a8b9c0aa')
      expect(doc.title).toBe('Senior Backend Engineer Job Description')
      expect(doc.category).toBe('Job Description')
      expect(doc.chunk_count).toBe(2)
      expect(doc.content_length).toBe(1250)
      expect(doc.scope).toBe('user')
      expect(doc.deletable).toBe(true)
    })

    it('resiliently handles empty, partial, or malformed document objects', () => {
      const fallback: DocumentInfo = normalizeDocumentInfo({})
      expect(fallback.id).toBe('')
      expect(fallback.title).toBe('Untitled Document')
      expect(fallback.category).toBe('general')
      expect(fallback.chunk_count).toBe(0)
      expect(fallback.content_length).toBe(0)
      expect(fallback.scope).toBe('user')
      expect(fallback.deletable).toBe(true)
      expect(typeof fallback.created_at).toBe('string')

      const nullFallback: DocumentInfo = normalizeDocumentInfo(null)
      expect(nullFallback.title).toBe('Untitled Document')
      expect(nullFallback.chunk_count).toBe(0)
    })
  })

  describe('normalizeKnowledgeBaseStats contract', () => {
    it('correctly maps realistic backend stats with categories count map to KnowledgeBaseStats', () => {
      const stats: KnowledgeBaseStats = normalizeKnowledgeBaseStats(
        backendKnowledgeBaseStatsFixture
      )

      expect(stats.total_documents).toBe(34)
      expect(stats.total_chunks).toBe(72)
      expect(stats.global_documents).toBe(34)
      expect(stats.global_chunks).toBe(72)
      expect(stats.user_documents).toBe(0)
      expect(stats.user_chunks).toBe(0)

      // Categories as string array for UI listing/filtering
      expect(stats.categories).toEqual([
        'Role Matrix',
        'Learning Path',
        'Career Guide',
        'Interview Guide',
      ])

      // Categories as count map Record<string, number> for badge counts
      expect(stats.categories_map).toBeDefined()
      expect(stats.categories_map?.['Role Matrix']).toBe(12)
      expect(stats.categories_map?.['Learning Path']).toBe(10)
      expect(stats.categories_map?.['Career Guide']).toBe(8)
      expect(stats.categories_map?.['Interview Guide']).toBe(4)

      // Metadata fields
      expect(stats.embedding_model).toBe('text-embedding-v3')
      expect(stats.vector_dimension).toBe(1024)
      expect(stats.retrieval_backend).toBe('atlas')
      expect(stats.storage_mode).toBe('mongodb')
      expect(stats.database_name).toBe('careerpilot_ai')
      expect(stats.status).toBe('ready')
      expect(stats.last_updated).toBe('2026-03-30T10:00:00.000Z')
    })

    it('tolerates legacy string[] categories without throwing', () => {
      const legacyPayload = {
        total_documents: 10,
        total_chunks: 20,
        categories: ['Backend', 'Frontend'],
      }
      const stats: KnowledgeBaseStats = normalizeKnowledgeBaseStats(legacyPayload)

      expect(stats.total_documents).toBe(10)
      expect(stats.total_chunks).toBe(20)
      expect(stats.categories).toEqual(['Backend', 'Frontend'])
      expect(stats.categories_map).toEqual({})
    })

    it('handles nullable database_name and last_updated safely', () => {
      const offlineStats = {
        ...backendKnowledgeBaseStatsFixture,
        storage_mode: 'memory',
        database_name: null,
        last_updated: null,
        last_seeded_at: null,
      }
      const stats: KnowledgeBaseStats = normalizeKnowledgeBaseStats(offlineStats)

      expect(stats.storage_mode).toBe('memory')
      expect(stats.database_name).toBeNull()
      expect(stats.last_updated).toBeNull()
    })

    it('falls back safely when given null or empty object', () => {
      const emptyStats: KnowledgeBaseStats = normalizeKnowledgeBaseStats({})
      expect(emptyStats.total_documents).toBe(0)
      expect(emptyStats.total_chunks).toBe(0)
      expect(emptyStats.categories).toEqual([])
      expect(emptyStats.categories_map).toEqual({})
      expect(emptyStats.storage_mode).toBe('mongodb')
      expect(emptyStats.status).toBe('ready')
    })
  })
})
