import React, { createContext, useContext, useState, useEffect } from 'react'
import { supervisorServices, convertDocsToArray } from '../services/firebaseServices'
import { collection, query, where, getDocs } from 'firebase/firestore'
import { db } from '../firebase'
import { useAuth } from '../components/Auth'

const SupervisorContext = createContext()

export const SupervisorProvider = ({ children }) => {
  const { user, userRole, loading } = useAuth()
  const [currentSupervisor, setCurrentSupervisor] = useState(null)
  const [assignedSites, setAssignedSites] = useState([])

  useEffect(() => {
    const fetchSupervisorContext = async () => {
      // Wait for Auth context to finish initial loading
      if (loading) return;

      console.log('🔧 SupervisorContext: State evaluated for user:', user?.email ?? 'none')

      // If user is absent, OR if user is an admin, skip supervisor logic.
      if (!user || userRole === 'admin') {
        setCurrentSupervisor(null)
        setAssignedSites([])
        return
      }

      // If user exists but role isn't populated yet, wait.
      // E.g., during the fraction of a second inside the login() flow.
      if (user && !userRole) {
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
    }

    fetchSupervisorContext()
  }, [user, userRole, loading])

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
