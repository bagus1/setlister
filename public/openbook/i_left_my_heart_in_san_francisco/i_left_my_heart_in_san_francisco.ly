




% lets emit the definitions

% end verbatim - this comment is a hack to prevent texinfo.tex
% from choking on non-European UTF-8 subsets

% this version tag will keep me compiling only on this version of lilypond.
%=====================================================================

\version "2.24.4"

% lets define a variable to hold the formatted build date (man 3 strftime):
%date=#(strftime "%T %d-%m-%Y" (localtime (current-time)))
%lilypond_version=#(lilypond-version)

% setting instruments for midi generation (bah - this doesn't work...)
%=====================================================================
%\set ChordNames.midiInstrument = #"acoustic grand"
%\set Staff.midiInstrument = #"flute"
%\set PianoStaff.instrumentName = #"acoustic grand"
% do not show chords unless they change...
%\set chordChanges = ##t

% number of staffs per page (this does not work because of my breaks)
%\paper {
%	system-count = #7
%}

\paper {
	% reduce spaces between systems and the bottom (taken from the lilypond
	% documentation and found the relevant variable)
	% the result of this is that I can fit 8 single staffs in one page
	% which is ideal for Jazz (think 32 bar divided into 8 lines of 4 bars each...).
	% I should really only apply this thing for Jazz tunes but that is a TODO item.
	% default is 4\mm - 3 already causes 8 staffs to take 2 pages
	between-system-padding = 2\mm
	% default is 20\mm
	% between-system-space = 16\mm
	% ragged-last-bottom = ##f
	% ragged-bottom = ##f

	% make lilypond increase the distance of the footer from the bottom of the page
	% it seems that if you don't do something like this you're going to have
	% a real problem seeing the footer in postscript printing....
	%bottom-margin = 2.5\cm

	% from /usr/share/lilypond/2.12.3/ly/titling-init.ly
	% to stop lilypond from printing footers...
	oddFooterMarkup = \markup {}

	% prevent lilypond from printing the headers...

	scoreTitleMarkup = \markup {}
	bookTitleMarkup = \markup {}
}
\layout {
	% don't have the first line indented
	indent = 0.0 \cm
	% don't know what this is (taken from Laurent Martelli...)
	%textheight = 1.5\cm

	\context {
		\Score
		% change the size of the text fonts
		%\override LyricText #'font-family = #'typewriter
		\override LyricText #'font-size = #'-2

		% set the style of the chords to Jazz - I don't see this making any effect
		\override ChordName #'style = #'jazz
		%\override ChordName #'word-space = #2

		% set the chord size and font
		%\override ChordName #'font-series = #'bold
		%\override ChordName #'font-family = #'roman
		%\override ChordName #'font-size = #-1

		% don't show bar numbers (for jazz it makes it too cluttery)
		\remove "Bar_number_engraver"
	}
}
% reduce the font size (taken from the lilypond info documentation, default is 20)
#(set-global-staff-size 17.82)

% There is no need to set the paper size to a4 since it is the default.
% make lilypond use paper of size a4 (Is this the default ?!?)
%#(set-default-paper-size "a4")
%)

% Don't have textedit:// links for every note in the pdf file.
% This reduces the size of the pdf by a lot
\pointAndClickOff

% chord related matters
myChordDefinitions={
	<c ees ges bes des' fes' aes'>-\markup \super {7alt}
	<c e g bes f'>-\markup \super {7sus}
	<c e g bes d f'>-\markup \super {9sus}
	<c e g f'>-\markup \super {sus}
	<c ees ges bes>-\markup { "m" \super { "7 " \flat "5" } }
	<c ees ges beses>-\markup { "dim" \super { "7" } }
	<c ees ges>-\markup { "dim" }
	%<c e g b>-\markup { "maj7" }
	<c e gis bes d'>-\markup { \super { "9 " \sharp "5" } }
	<c e g bes d' a'>-\markup \super {13}
	<c e g bes d' fis'>-\markup { \super { "9 " \sharp "11" } }
}
myChordExceptions=#(append
	(sequential-music-to-chord-exceptions myChordDefinitions #t)
	ignatzekExceptions
)

% some macros to be reused all over
% =====================================================================
myBreak=\break
% do line breaks really matter?
myEndLine=\break
%myEndLine={}
myEndLineVoltaNotLast={}
myEndLineVoltaLast=\break
myEndLineVolta=\break
partBar=\bar "||"
endBar=\bar "|."
startBar=\bar ".|"
startRepeat=\bar "|:"
endRepeat=\bar ":|"
startTune={}
endTune=\bar "|."
myFakeEndLine={}
mySegno=\mark \markup { \musicglyph #"scripts.segno" }
myCoda=\mark \markup { \musicglyph #"scripts.coda" }

% some functions to be reused all over
% =====================================================================
% A wrapper for section markers that allows us to control their formatting

% You can have a circle instead of a box using:
% \mark \markup { \circle #mark }
myMark =
#(define-music-function
	(parser location mark)
	(markup?)
	#{
	\mark \markup { \box #mark }
	#})
myWordMark =
#(define-music-function
	(parser location mark)
	(markup?)
	#{
	\mark \markup { \box #mark }
	#})
% grace that does appoggiatura
%\grace $notes
myGrace = #(define-music-function (parser location notes) (ly:music?) #{ \appoggiatura $notes #})
% grace that does nothing
%myGrace = #(define-music-function (parser location notes) (ly:music?) #{ #})

% this is a macro that * really * breaks lines. You don't really need this since a regular \break will work
% AS LONG AS you have the '\remove Bar_engraver' enabled...
hardBreak={ \bar "" \break }
% a macro to make vertical space
verticalSpace=\markup { \null }

% macros to help in parenthesizing chords
% see the playground area for openbook and http://lilypond.1069038.n5.nabble.com/Parenthesizing-chord-names-td44370.html
#(define (left-parenthesis-ignatzek-chord-names in-pitches bass inversion context) (markup #:line ("(" (ignatzek-chord-names in-pitches bass inversion context))))
#(define (right-parenthesis-ignatzek-chord-names in-pitches bass inversion context) (markup #:line ((ignatzek-chord-names in-pitches bass inversion context) ")")))
#(define (parenthesis-ignatzek-chord-names in-pitches bass inversion context) (markup #:line ("(" (ignatzek-chord-names in-pitches bass inversion context) ")")))
LPC = { \once \set chordNameFunction = #left-parenthesis-ignatzek-chord-names }
RPC = { \once \set chordNameFunction = #right-parenthesis-ignatzek-chord-names }
OPC = { \once \set chordNameFunction = #parenthesis-ignatzek-chord-names }

% some macros for marking parts of jazz tunes
% =====================================================================
startSong={}
% If we want endings of parts to be denoted by anything we need
% to find a smarter function that this since this will tend
% to make other things disapper (repeat markings etc)
%endSong=\bar "|."
endSong={}
startPart={}
% If we want endings of parts to be denoted by anything we need
% to find a smarter function that this since this will tend
% to make other things disapper (repeat markings etc)
% endPart=\bar "||"
endPart={}
startChords={
	% this causes chords that do not change to disappear...
	\set chordChanges = ##t
	% use my own chord exceptions
	\set chordNameExceptions = #myChordExceptions
}
endChords={}


% lets always include guitar definitions
\include "predefined-guitar-fretboards.ly"



% from here everything needs to go into a loop

% include anything the user wants before the bookpart starts








% this causes the variables to be defined...












% now play with the variables that depend on language



% calculate the tag line


% calculate the typesetby









% taken from "/usr/share/lilypond/2.12.3/ly/titling-init.ly"
\markup {
	\column {
		\override #'(baseline-skip . 3.5)
		\column {
			\huge \larger \bold
			\fill-line { \larger "I Left My Heart In San Francisco" }
			\fill-line {
				"Lyrics by Douglass Cross"
				"Music by Geroge Cory"
			}
			\fill-line {
				"Slowly"
				""
			}
		}
	}
}
\noPageBreak


% include the preparatory stuff, if there is any

% calculate the vars



% score for printing
\score {
	<<
\new ChordNames="Chords"
	\with {
		\remove "Bar_engraver"
	}
% # transpose with 'inline' is true!
	\transpose c c {


\chordmode {
	\startSong
	\startChords

	\partial 2. s2. |

	\myMark "A"
	\startPart
	bes1 | d2:m7 cis:dim7 | c1:m7 | c:m7 |
	c:m7 | c2:m7/f f:7.5+ | bes1 |
	\endPart

	\myMark "B"
	\startPart
	bes2 c4:m7 cis:dim7 | bes1 | d2:m7 cis:dim7 | d1:m7 | d2:m7 d:7.9- |
	g1:m7 | c2:9 c:7.9- | f:9 b:dim7 | c:m7 f:7 |
	\endPart

	\myMark "A'"
	\startPart
	bes1 | d2:m7 cis:dim7 | c1:m7 |
	c:m7 | f:9 | f2:9 ees:9 | d1:7 |
	\endPart

	\myMark "C"
	\startPart
	d:7 | g2.:7.5+ g4:9 | g1:9 |
	c2. g4:m7 | c1:9 | c:m7 | c2:m7/f f:7.9- | bes2:6 aes4:6.9 a:6.9 | bes1:6.9 |
	\endPart

	\endChords
	\endSong
}


}
% this thing will only engrave voltas. This is required to put the volta under the chords.
% No great harm will happen if you don't put it, only the voltas will be above the chords.
%\new Staff \with {
%	\consists "Volta_engraver"
%}
\new Staff="Melody" {
\new Voice="Voice"
% # transpose with 'inline' is true!
	\transpose c c { \relative c'
	



{
	\tempo "Andante Moderato" 4 = 88
	\time 4/4
	\key bes \major

	d4 ees g | f1 | r4 g a4. bes8 | g c,4.~ c4 r | r c b c | g'1 | r4 bes a4. f8 |
	d2 r | r4 d ees e | f8 ees4 d16 ees f2~ | f4 r r g | a8 g4 f16 g a2~ | a4 a gis4. a8 |
	bes1~ | bes4 c a4. c,8 | f2 r4 g8 f | ees4 r8 d ees4 g | f1 | r4 g a bes | g8 c,4.~ c4 r |
	r c b c | a'1~ | a4 a bes c | d1 | r4 d cis4. d8 | ees2. d4 | b2 c4 d |
	c g2. | r4 g fis g | ees'2. g,4 | d'2 d | bes1~ | bes4 r r2 |
}

 }
}
\new Lyrics="Lyrics" \lyricsto "Voice" {
	




\lyricmode {
	I Left My Heart In San Fran -- cis -- co, __ high on a hill, it calls to
	me. To be where lit -- tle ca -- ble cars __ climb half -- way to the stars! __ to morn -- ing
	fog __ may chill the air I don't care! My love waits there in San Fran -- cis -- co, __
	a -- bove the blue __ and wind -- y sea. When I come home to you San Fran -- cis-- co your gold -- en sun will sine for me. __
}

}
	>>
	\layout {
	}
}
% score for midi
\score {
	\unfoldRepeats
	<<
\new ChordNames="Chords"
	


\chordmode {
	\startSong
	\startChords

	\partial 2. s2. |

	\myMark "A"
	\startPart
	bes1 | d2:m7 cis:dim7 | c1:m7 | c:m7 |
	c:m7 | c2:m7/f f:7.5+ | bes1 |
	\endPart

	\myMark "B"
	\startPart
	bes2 c4:m7 cis:dim7 | bes1 | d2:m7 cis:dim7 | d1:m7 | d2:m7 d:7.9- |
	g1:m7 | c2:9 c:7.9- | f:9 b:dim7 | c:m7 f:7 |
	\endPart

	\myMark "A'"
	\startPart
	bes1 | d2:m7 cis:dim7 | c1:m7 |
	c:m7 | f:9 | f2:9 ees:9 | d1:7 |
	\endPart

	\myMark "C"
	\startPart
	d:7 | g2.:7.5+ g4:9 | g1:9 |
	c2. g4:m7 | c1:9 | c:m7 | c2:m7/f f:7.9- | bes2:6 aes4:6.9 a:6.9 | bes1:6.9 |
	\endPart

	\endChords
	\endSong
}



\new Staff="Melody" {
\new Voice="Voice"
	\relative c'
	



{
	\tempo "Andante Moderato" 4 = 88
	\time 4/4
	\key bes \major

	d4 ees g | f1 | r4 g a4. bes8 | g c,4.~ c4 r | r c b c | g'1 | r4 bes a4. f8 |
	d2 r | r4 d ees e | f8 ees4 d16 ees f2~ | f4 r r g | a8 g4 f16 g a2~ | a4 a gis4. a8 |
	bes1~ | bes4 c a4. c,8 | f2 r4 g8 f | ees4 r8 d ees4 g | f1 | r4 g a bes | g8 c,4.~ c4 r |
	r c b c | a'1~ | a4 a bes c | d1 | r4 d cis4. d8 | ees2. d4 | b2 c4 d |
	c g2. | r4 g fis g | ees'2. g,4 | d'2 d | bes1~ | bes4 r r2 |
}


}
	>>
	\midi {
	}
}


\noPageBreak
\markup \column {
	% just a little space
	\null
	\fill-line {
		\smaller \smaller { "Copyright © 1954 General Music Publishing Co., Inc." }
	}

	\fill-line {
		\smaller \smaller { "Typeset by Jordan Eldredge <jordan@jordaneldredge.com>, Built at 17:52:17 28-09-2025, Engraved by lilypond 2.24.4" }
	}
	\fill-line {
		\smaller \smaller { \with-url #"https://veltzer.github.io/openbook" https://veltzer.github.io/openbook }
	}
}





