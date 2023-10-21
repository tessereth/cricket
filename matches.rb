#!/usr/bin/env ruby

require 'uri'
require 'net/http'
require 'json'

def get(last: 17185, limit: 200)
  uri = URI("https://apiv2.cricket.com.au/web/fixtures/yearfilter?isCompleted=false&startDateTime=2023-01-01T00%3A00%3A00.000Z&limit=#{limit}&lastId=#{last}&isInningInclude=true&jsconfig=eccn%3Atrue&format=json")
  res = Net::HTTP.get_response(uri)
  JSON.parse(res.body)
end

def show(match)
  start = Time.parse(match["startDateTime"]).getlocal.strftime("%Y-%m-%d")
  url = "https://www.cricket.com.au/matches/CA:#{match["id"]}"
  "#{start} #{match["venue"]["location"].ljust(10)} #{match["competition"]["name"]} #{match["homeTeam"]["shortName"]} vs #{match["awayTeam"]["shortName"]} - #{url}"
end

data = get

data["fixtures"].map {|m| show(m) }

def for_location(data, location)
  data["fixtures"].select {|m| m["venue"]["location"].downcase.include?(location.downcase)}
end

for_location(data, "Sydney").map {|m| show(m) }



