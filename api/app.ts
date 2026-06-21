import express, {
  type Request,
  type Response,
  type NextFunction,
} from 'express'
import cors from 'cors'
import path from 'path'
import dotenv from 'dotenv'
import { fileURLToPath } from 'url'
import memberRoutes from './routes/member.routes'
import scheduleRoutes from './routes/schedule.routes'
import configRoutes from './routes/config.routes'
import exportRoutes from './routes/export.routes'
import { errorHandler, notFoundHandler } from './middleware/error.handler'
import { initDatabase } from './database/init'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

dotenv.config()

const app: express.Application = express()

app.use(cors())
app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true, limit: '10mb' }))

initDatabase().catch(err => {
  console.error('Failed to initialize database:', err)
})

app.use(
  '/api/health',
  (req: Request, res: Response, next: NextFunction): void => {
    res.status(200).json({
      success: true,
      message: 'ok',
    })
  },
)

app.use('/api/members', memberRoutes)
app.use('/api/schedules', scheduleRoutes)
app.use('/api/config', configRoutes)
app.use('/api/export', exportRoutes)

app.use(notFoundHandler)
app.use(errorHandler)

export default app
