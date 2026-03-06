import React, { createContext, useContext, useState, useEffect } from 'react'
import { onAuthStateChanged } from 'firebase/auth'
import { auth } from '../firebase'
import { supervisorServices, convertDocsToArray } from '../services/firebaseServices'
import { collection, query, where, getDocs, getDoc, doc } from 'firebase/firestore'
import { db } from '../firebase'

const SupervisorContext = createContext()

const ADMIN_EMAIL = 'odedraarjun928@gmail.com'

export const SupervisorProvider = ({ children }) => {
  const [currentSupervisor, setCurrentSupervisor] = useState(null)
  const [assignedSites, setAssignedSites] = useState([])

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      console.log('🔧 SupervisorContext: Auth state changed – user:', user?.email ?? 'none')

      if (!user || user.email === ADMIN_EMAIL) {
        setCurrentSupervisor(null)
        setAssignedSites([])
        return
      }

      try {
        console.log('🔧 SupervisorContext: Fetching supervisor doc for:', user.email)
        const supervisorSnapshot = await supervisorServices.getSupervisorByEmail(user.email)
        const supervisors = supervisorSnapshot.docs.map(d => ({ id: d.id, ...d.data() }))
        console.log('🔧 SupervisorContext: Found supervisor docs:', supervisors.length)

        if (supervisors.length === 0) {
          console.warn('🔧 SupervisorContext: No supervisor document found for', user.email)
          setCurrentSupervisor(null)
          setAssignedSites([])
          return
        }

        const supervisor = supervisors[0]
        console.log('🔧 SupervisorContext: Supervisor doc:', supervisor)
        setCurrentSupervisor(supervisor)

        // ── Fetch assigned sites using MULTIPLE strategies ───────────────────
        // We merge all results by siteId (deduplicated) so that ANY assignment
        // shape works: uid in assignedSupervisors, email in assignedSupervisors,
        // supervisor.id (Firestore doc ID) in assignedSupervisors, or siteId
        // in supervisor.assignedSites.

        const seen = new Set()
        const allMatchedSites = []

        const addSite = (data) => {
          if (data && !seen.has(data.id) && !data.is_deleted) {
            seen.add(data.id)
            allMatchedSites.push(data)
          }
        }

        // STRATEGY 1 — Query sites where assignedSupervisors contains any of
        // the supervisor's known identifiers (UID, email, or Firestore doc ID).
        // Rules now allow supervisors to read all sites so this always works.
        const identifiers = [user.uid, user.email, supervisor.id].filter(Boolean)
        await Promise.all(identifiers.map(async (value) => {
          try {
            const q = query(
              collection(db, 'sites'),
              where('assignedSupervisors', 'array-contains', value)
            )
            const snap = await getDocs(q)
            snap.docs.forEach(d => addSite({ id: d.id, ...d.data() }))
          } catch (e) {
            console.warn('🔧 SupervisorContext: array-contains query failed for', value, '–', e.message)
          }
        }))

        // STRATEGY 2 — Direct reads from supervisor.assignedSites[] (IDs).
        // Catches sites where admin stored the siteId on the supervisor doc
        // but didn't update site.assignedSupervisors.
        const supervisorAssignedIds = (supervisor.assignedSites || []).filter(
          id => !seen.has(id)
        )
        if (supervisorAssignedIds.length > 0) {
          console.log('🔧 SupervisorContext: supervisor.assignedSites to fetch:', supervisorAssignedIds)
          const siteReads = await Promise.allSettled(
            supervisorAssignedIds.map(siteId => getDoc(doc(db, 'sites', siteId)))
          )
          siteReads.forEach((result) => {
            if (result.status === 'fulfilled' && result.value.exists()) {
              addSite({ id: result.value.id, ...result.value.data() })
            }
          })
        }

        console.log(
          '🔧 SupervisorContext: Resolved assigned sites:',
          allMatchedSites.length,
          allMatchedSites.map(s => s.name)
        )
        setAssignedSites(allMatchedSites)

      } catch (error) {
        console.error('🔧 SupervisorContext: Error loading supervisor data:', error)
        setCurrentSupervisor(null)
        setAssignedSites([])
      }
    })

    return () => unsubscribe()
  }, [])

  const value = {
    currentSupervisor,
    assignedSites,
    isSupervisor: !!currentSupervisor
  }

  return (
    <SupervisorContext.Provider value={value}>
      {children}
    </SupervisorContext.Provider>
  )
}

export const useSupervisor = () => {
  const context = useContext(SupervisorContext)
  if (!context) {
    throw new Error('useSupervisor must be used within a SupervisorProvider')
  }
  return context
}
